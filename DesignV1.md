# 📚 PDF 智能阅读 Agent（Gemini + 结构化笔记）

> 一个带「记忆」的 PDF 学术阅读 Agent：
> - 左侧：自动生成 & 可收藏的 **笔记区**
> - 中间：可缩放的 **PDF 阅读区**
> - 右侧：基于 Gemini API 的 **交互面板 / Agent 控制台**

面向课程项目设计：强调 **Agent workflow + 工具调用 + 记忆**，实现难度可控，一天内可做出一个可演示的 MVP。

---

## 0. 功能概览（MVP 版本）

### 🎯 用户视角

1. 用户上传一篇 PDF 论文。
2. 系统自动：
   - 解析 PDF
   - **立即**调用 Gemini 对全文进行**全面总结**
   - 自动将总结生成一张或多张「卡片」，直接加入左侧笔记区。
3. 用户在中间窗口正常阅读 PDF（支持翻页 & 缩放）。
4. 用户在右侧 Agent 控制台：
   - **上方**：显示当前页码等上下文信息。
   - **中间**：一个可滚动的**对话/聊天区域**。用户可以在输入框提问（如“解释这段话”），系统的回答将以「卡片」形式出现在对话流中，支持“Add to Notebook”。
   - **底部**：放置快捷工具按钮（`Summarize this page`, `Draw diagram`），点击后生成的结果也会作为卡片插入对话流。
5. 系统调用 Agent backend：
   - 读取对应页内容
   - 调用 Gemini 生成 **文字解释 / 图示描述**
   - 返回作为「卡片」展示在右侧
   - 用户可以点「Add to Notebook」把右侧卡片加入左侧笔记区
6. 最后用户可以点击「Export Markdown」，把左侧笔记导出为一份 `.md` 文件，作为这篇论文的阅读笔记。

---

## 1. 整体架构设计

### 1.1 前后端分离

- 前端：React（或 Next.js）
  - PDF 显示：`react-pdf`（底层用 pdf.js）
  - UI 布局：三栏布局（Left / Center / Right）
- 后端：Python + FastAPI（推荐）
  - PDF 解析：`PyMuPDF`（`fitz`）或 `pdfplumber`
  - 向量检索（可选）：`faiss` 或 `chromadb`
  - LLM 调用：Gemini API
- 存储：
  - 临时：内存 + 简单 JSON 文件
  - 简单可行方案：
    - 会话级状态在前端保存（React state）
    - 文档级“长期记忆”保存在 `data/docs/<doc_id>.json`

### 1.2 三大模块

1. **Frontend UI**
   - `PDFViewer`：PDF 显示 & 缩放、翻页
   - `NotebookPanel`：左侧笔记区
   - `AgentPanel`：右侧交互区
2. **Backend Services**
   - `Document Service`：上传 & 解析 PDF
   - `Agent Service`：封装 Agent workflow
   - `Memory Service`：管理文档笔记 / 会话历史
3. **LLM & Tools**
   - `GeminiClient`：统一封装 Gemini 请求
   - `Tools`：
     - `summarize_page`
     - `summarize_document_keypoints`
     - `explain_equation`
     - `draw_algorithm_diagram`（MVP 可先只生成图的文字描述）

---

## 2. 功能拆解（从前端视角）

### 2.1 页面布局

三栏布局示意：

```text
+------------------------------------------------------------+
|  NotebookPanel  |           PDFViewer         | AgentPanel |
|  (left, 25%)    |         (middle, 50%)       | (right,25%)|
+------------------------------------------------------------+

实现方式（示意）：

<div className="app-layout">
  <NotebookPanel
    notebookCards={notebookCards}
    onRemove={...}
    onExportMarkdown={...}
  />

  <PDFViewer
    file={currentPdfFile}
    page={currentPage}
    onPageChange={setCurrentPage}
    onZoomChange={setZoom}
  />

  <AgentPanel
    docId={docId}
    currentPage={currentPage}
    onAddCardToNotebook={addCardToNotebook}
  />
</div>



### 2.2 左侧：NotebookPanel（笔记区）

职责：
	•	显示「当前文档」的关键笔记卡片（auto + 用户收藏）
	•	支持：
	•	从右侧 AgentPanel 添加卡片
	•	删除卡片
	•	导出所有卡片为 Markdown 文件

数据结构示例：

type NoteCard = {
  id: string;
  type: 'overview' | 'page_summary' | 'equation_explanation' | 'diagram';
  title: string;
  content: string;      // markdown or plain text
  page?: number;
  imageUrl?: string;    // 若是图示类卡片
  createdAt: string;
};

导出 Markdown 的逻辑：

简单拼接：
```python
# Notes for <PDF Title>

## Overview
- ...

## Page 3: Equation Explanation
...

## Diagram
![diagram](...)
```
前端用 Blob + URL.createObjectURL 触发下载 .md 文件即可。

⸻

### 2.3 中间：PDFViewer

职责：
	•	显示 PDF
	•	支持：
	•	翻页（上一页 / 下一页）
	•	缩放（放大 / 缩小）

建议：
	•	使用 react-pdf：
	•	<Document file={file}>
	•	<Page pageNumber={currentPage} scale={zoom} />

状态:
	•	currentPage: number
	•	zoom: number

⸻

### 2.4 右侧：AgentPanel（交互区）

职责：
	•	**Top**: 显示当前文档 & 页信息 (Context)
	•	**Middle**: 滚动聊天窗口 (Chat History)
	    •	用户消息（气泡）
	    •	Agent 回复（**卡片形式**），每个卡片带「Add to Notebook」按钮
	•	**Bottom**: 交互输入区
	    •	文本输入框 + 发送按钮
	    •	快捷工具栏：[Summarize Page] [Draw Diagram]

状态：
```json
type Message = {
  role: 'user' | 'assistant';
  content?: string;
  card?: NoteCard; // 如果是 assistant 回复，通常是一个卡片
};

type AgentPanelState = {
  loading: boolean;
  messages: Message[];
  input: string;
  error?: string;
};
```
交互流程示例：
	1.	**自动总结（Auto-Summary）**：
	    •	PDF 上传成功后，前端自动调用 `POST /api/agent/init-notes`。
	    •	后端生成“全文总结卡片”，前端收到后直接存入 `NotebookPanel`（左侧），同时也可以在 Chat 中显示一条“已生成全文总结”的系统消息。

	2.	**用户提问 (Chat)**：
	    •	用户输入 "Explain the formula on this page"。
	    •	前端发送 `POST /api/agent/chat` (带上 history & current page text)。
	    •	后端返回一个 `NoteCard` (type='explanation')。
	    •	前端将此卡片渲染在 Chat 流中。
	    •	用户点击卡片上的 "Add to Notebook"，卡片被复制到左侧。

	3.	**快捷按钮 (Quick Actions)**：
	    •	用户点击底部的 “Summarize this page”。
	    •	前端发送 `POST /api/agent/run-task` (task='summarize_page')。
	    •	后端返回卡片。
	    •	前端将卡片插入 Chat 流中显示。

⸻

## 3. 后端设计（FastAPI 示例）

### 3.1 路由概览

POST /api/upload-pdf       -> 上传 PDF，返回 doc_id
GET  /api/doc/{doc_id}/meta -> 获取基本信息（页数、标题）
POST /api/agent/init-notes -> 对整篇文档生成“关键笔记”（左侧初始笔记）
POST /api/agent/run-task   -> 针对 doc_id + page + task_type 生成卡片

### 3.2 数据结构

文档元信息
```json
# data/docs/<doc_id>.json
{
  "doc_id": "abc123",
  "file_path": "data/uploads/abc123.pdf",
  "title": "Some Paper",
  "num_pages": 12,
  "created_at": "...",
  "notes": [ /* 可选：自动生成的长期笔记 */ ]
}
```

⸻

### 3.3 PDF 解析模块（Document Parser）

核心功能：
	•	打开 PDF，获取页数、标题（可选）
	•	提取指定页的纯文本

示意（PyMuPDF）：
```python
import fitz  # pymupdf

def extract_page_text(pdf_path: str, page_num: int) -> str:
    doc = fitz.open(pdf_path)
    page = doc[page_num - 1]
    text = page.get_text()
    return text
```
你可以在 backend 启动时不必预先解析全文，只在需要的时候按页提取。

⸻

### 3.4 LLM Client（Gemini 封装）

建议封装一个统一的 LLM client：
```python
class GeminiClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        ...

    async def summarize_page(self, page_text: str) -> str:
        prompt = f"""
        You are an assistant for reading research papers.
        Please summarize the following page in 3-5 bullet points.
        Page text:
        {page_text}
        """
        # 调用 Gemini API，返回 summary 文本
        ...

    async def draw_algorithm_diagram_prompt(self, page_text: str) -> str:
        prompt = f"""
        From the following text, extract the main algorithm or pipeline,
        and describe it as a simple diagram specification:
        - List boxes (nodes) and their labels
        - List arrows (edges) and their directions

        Text:
        {page_text}
        """
        # 返回描述图结构的英文自然语言
        ...
```
⚠️ 与 Nano Banana 的真正确认接入（生成图像）可以作为 扩展，MVP 可以只返回 “diagram text description”。

⸻

### 3.5 Agent 工具封装（Tools）

定义统一的工具接口：
```python
from typing import Dict, Any, List

async def tool_summarize_page(doc, page: int, llm: GeminiClient) -> List[Dict[str, Any]]:
    text = extract_page_text(doc["file_path"], page)
    summary = await llm.summarize_page(text)
    return [{
        "id": f"page-{page}-summary",
        "type": "page_summary",
        "title": f"Summary of page {page}",
        "content": summary,
        "page": page
    }]

async def tool_draw_diagram(doc, page: int, llm: GeminiClient) -> List[Dict[str, Any]]:
    text = extract_page_text(doc["file_path"], page)
    diagram_desc = await llm.draw_algorithm_diagram_prompt(text)
    # MVP：先不调生图 API，只返回文字描述
    return [{
        "id": f"page-{page}-diagram",
        "type": "diagram",
        "title": f"Algorithm diagram for page {page}",
        "content": diagram_desc,
        "page": page
    }]
```

⸻

### 3.6 Agent Controller（Planner）

MVP 可以是一个简单的 if-else 调度器：
```python
TASK_TOOL_MAP = {
    "summarize_page": tool_summarize_page,
    "draw_diagram_page": tool_draw_diagram,
}

@app.post("/api/agent/run-task")
async def run_task(req: RunTaskRequest):
    doc = load_doc_meta(req.doc_id)
    tool_fn = TASK_TOOL_MAP.get(req.task_type)
    if tool_fn is None:
        raise HTTPException(400, "Unknown task_type")

    cards = await tool_fn(doc, req.page, gemini_client)
    return {"cards": cards}
```
之后若要“更 agentic”，可以让 Gemini 自己选工具；MVP 不需要。

⸻

### 3.7 初始化笔记（左侧 auto-notes）

当用户上传 PDF 后，可以提供一个按钮：
	•	Generate overview notes

### 3.7 初始化笔记（左侧 auto-notes）

**机制：自动触发**

当用户上传 PDF 成功（获得 `doc_id`）后，前端**立即**自动调用后端接口：
`POST /api/agent/init-notes`

后端逻辑：
1. 读取 PDF 全文（或前 N 页，视 token 限制而定）。
2. 调用 Gemini 生成结构化的“全文总结”。
3. 返回 1 张或多张 `NoteCard` (type='overview')。
4. 前端收到后，直接更新到左侧 `NotebookPanel` 的状态中。

⸻•	存在前端：
	•	当前会话中生成过哪些卡片
	•	当前选择了哪一篇 PDF，当前页是多少
	•	用处：
	•	例如：后续问题可以引用“上一个卡片”的内容（MVP 可以先不做）

### 4.2 长期记忆（Document Memory）
	•	存在后端 JSON 文件中：
	•	用户收藏的卡片（notebook）
	•	自动生成的 overview 卡片
	•	结构类似：
```json
{
  "doc_id": "abc123",
  "title": "Paper Title",
  "notes": [
    {
      "id": "card-001",
      "type": "overview",
      "title": "...",
      "content": "...",
      "page": null
    },
    {
      "id": "card-002",
      "type": "page_summary",
      "title": "Summary of page 3",
      "content": "...",
      "page": 3
    }
  ]
}
```
	•	当用户再次打开这个 doc_id 时：
	•	后端加载 notes，前端把它们渲染在左侧 Notebook 中

⸻

## 5. 开发步骤建议（一天内的路线）

Step 0：搭基础项目
	•	初始化前端（React + Vite / Next.js 均可）
	•	初始化后端（FastAPI / Flask）
	•	前后端之间先写一个简单的 GET /ping 测试联通

⸻

Step 1：先搞定中间 PDFViewer
	•	前端引入 react-pdf
	•	支持：
	•	本地先写死一个 pdf 文件 URL（后面再接上传）
	•	可以翻页
	•	可以缩放

⸻

Step 2：接入 PDF 上传 + doc_id
	•	前端加一个上传按钮：
	•	上传成功后，获取 doc_id 和 num_pages
	•	中间 PDFViewer 改为用后端返回的文件 URL 渲染

⸻

Step 3：实现 AgentPanel Chat UI & 快捷指令
	•	前端：
	    •	改造 AgentPanel 为：Header + ChatList + InputArea + BottomButtons。
	    •	实现消息流展示（支持渲染 Card 组件）。
	•	后端：
	    •	实现 `/api/agent/chat` 接口（处理用户自然语言提问）。
	    •	复用/调整 `/api/agent/run-task` 适配新的交互模式。

⸻

Step 4：实现自动全文总结 (Auto-Summary)
	•	后端：
	    •	实现 `/api/agent/init-notes`。
	    •	编写 Prompt：阅读全文并生成结构化总结。
	•	前端：
	    •	在 `handleFileUpload` 成功后，自动触发 `init-notes`。
	    •	将返回的卡片自动加入 `notes` 状态。

⸻

Step 5：左侧 NotebookPanel + 导出
	•	实现：
	•	notebookCards state
	•	addCardToNotebook(card)
	•	removeCard(id)
	•	exportToMarkdown()

⸻

Step 5：扩展第二个工具：Draw diagram
	•	后端：
	•	实现 tool_draw_diagram，先只生成图结构说明的文本
	•	前端：
	•	在 AgentPanel 中增加第二个按钮

若时间富余，再考虑真的去接 Nano Banana API 生成图片并在卡片中显示。

⸻

## 6. 后续可以扩展的方向（非 MVP）
	•	支持「公式级解释」：用户点击 PDF 中公式，传坐标给后端。
	•	支持「高亮段落 → 右键菜单 → Explain this part」。
	•	记忆增强：
	•	对每篇文档构建概念图 / 术语表。
	•	更智能的 Planner：
	•	由 Gemini 决定调用哪些工具，而不仅仅是按钮对应一个工具。

