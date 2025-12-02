# 📚 PDF 智能阅读 Agent（Gemini + 结构化笔记）

> 一个带「记忆」的 PDF 学术阅读 Agent：
> - 左侧：自动生成 & 可收藏的 **笔记区**
> - 中间：可缩放的 **PDF 阅读区**
> - 右侧：基于 Gemini API 的 **交互面板 / Agent 控制台**

---

## 0. 功能概览（MVP 版本）

### 🎯 用户视角

1. 用户上传一篇 PDF 论文。
2. 系统自动：
   - 解析 PDF
   - **立即**调用 Gemini 对全文进行**全面总结**
   - **同时**调用 Gemini (Nano Banana/Flash-Image) 为该文档生成一张**封面图/概念图**。
   - 自动将总结和图片生成一张或多张「卡片」，直接加入左侧笔记区。
3. 用户在中间窗口正常阅读 PDF（支持翻页 & 缩放）。
4. 用户在右侧 Agent 控制台：
   - **上方**：显示当前页码等上下文信息。
   - **中间**：一个可滚动的**对话/聊天区域**。用户可以在输入框提问（如“解释这段话”），系统的回答将以「卡片」形式出现在对话流中，支持“Add to Notebook”。
   - **底部**：放置快捷工具按钮（`Summarize this page`, `Draw diagram`），点击后生成的结果也会作为卡片插入对话流。
5. 系统调用 Agent backend：
   - 读取对应页内容
   - 调用 Gemini 生成 **文字解释 / 算法原理图 (Image)**
   - 返回作为「卡片」展示在右侧
   - 用户可以点「Add to Notebook」把右侧卡片加入左侧笔记区
6. 最后用户可以点击「Export Markdown」，把左侧笔记导出为一份 `.md` 文件，作为这篇论文的阅读笔记。

---

## 1. 整体架构设计 (Agent Cognitive Architecture)

为了对齐通用 Agent 的能力范式，我们将系统划分为四个核心模块：**Perception（感知）**、**Planning（规划）**、**Action（行动）** 和 **Memory（记忆）**。

### 1.1 Perception (感知层)
负责收集和处理多模态输入：
- **文档感知**：解析 PDF 文档，提取文本、图像、表格布局信息。
- **用户感知**：接收用户的自然语言指令（Chat）或显式交互（点击按钮）。
- **环境感知**：当前的阅读状态（当前页码、缩放比例）。

### 1.2 Planning (规划层)
负责根据感知到的信息，决策下一步的操作序列：
- **意图识别**：理解用户是想“总结”、“解释”、“画图”还是“闲聊”。
- **任务编排**：将复杂需求拆解为 Action 序列（例如：“先总结这一页，然后画一张图”）。
- **模型驱动**：利用 Gemini 的推理能力，动态选择最合适的 Action。

### 1.3 Action (行动层)
定义 Agent 可调用的通用工具函数（Tools），支持多模态输入：
- **`action_summarize(input: Any)`**：对输入内容（文本/图片）进行总结或解释。
- **`action_draw(input: Any)`**：根据输入内容（文本/图片）生成可视化图像。
- **`action_search(query: str)`**：(可选) 检索文档内的特定信息。

### 1.4 Memory (记忆层)
- **Short-term (Context)**：当前的对话历史、当前页面的内容。
- **Long-term (Storage)**：
  - **Document Memory**：已生成的笔记卡片、文档摘要。
  - **User Memory (Future)**：用户的阅读偏好、风格习惯（如“喜欢详细的解释”或“喜欢简短的列表”）。

---

## 2. 前端功能拆解

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

    async def generate_image(self, prompt: str) -> bytes:
        # 使用 gemini-2.5-flash-image 生成图片
        # 示例代码：
        # from google import genai
        # client = genai.Client()
        # response = client.models.generate_content(
        #     model="gemini-2.5-flash-image",
        #     contents=[prompt],
        # )
        # for part in response.parts:
        #     if part.inline_data is not None:
        #         return part.as_image() 
        ...
```
⚠️ 与 Nano Banana 的真正确认接入（生成图像）可以作为 扩展，MVP 可以只返回 “diagram text description”。

⸻

### 3.5 Agent Action Tools (通用工具封装)

为了适应 Gemini 的多模态能力，我们将工具抽象为通用的 Action 接口。

#### 1. `action_summarize(input: Union[str, List[Image]]) -> NoteCard`
- **功能**：对输入的内容进行理解、总结或解释。
- **Input**：
  - `text`: 页面文本、用户问题。
  - `images`: PDF 页面截图（Gemini 可直接看图）、用户上传的图片。
- **Output**：结构化的文本总结（Markdown）。
- **实现逻辑**：
  ```python
  async def action_summarize(input_content, context=None):
      # 构造 Prompt，如果是图片则直接传入 Image 对象
      prompt = "Analyze and summarize the following content..."
      response = await gemini.generate_content([prompt, input_content])
      return create_card(type="summary", content=response.text)
  ```

#### 2. `action_draw(input: Union[str, List[Image]]) -> NoteCard`
- **功能**：根据输入内容生成可视化图像（图表、概念图、封面）。
- **Input**：
  - `text`: 文本描述、算法步骤。
  - `images`: 草图、需要重绘的图表。
- **Output**：生成的图片 URL。
- **实现逻辑**：
  ```python
  async def action_draw(input_content):
      # 1. 理解输入，生成绘图 Prompt (Text-to-Image Prompt)
      image_prompt = await gemini.generate_content(["Describe a visualization for:", input_content])
      
      # 2. 调用生图模型 (Gemini 2.5 Flash Image / Nano Banana)
      image_bytes = await gemini.generate_image(image_prompt.text)
      return create_card(type="image", imageUrl=save(image_bytes))
  ```

---

### 3.6 Agent Planning (规划与调度)

Agent Service 充当 Brain 的角色，接收 Perception 层的输入，进行 Planning，然后调度 Action。

**Planning 流程：**

1. **Receive Input**: 用户指令 ("解释这个公式") + 当前上下文 (Page 5 Text/Image)。
2. **Reasoning (Gemini)**: 
   - 分析用户意图 -> "需要解释"。
   - 决定调用工具 -> `action_summarize`。
3. **Execution**: 执行 `action_summarize(page_content)`。
4. **Response**: 返回结果卡片。

**代码结构示意：**

```python
async def agent_plan_and_execute(doc_id, page, user_instruction):
    # 1. Perception
    context = get_page_content(doc_id, page) # Text or Image
    
    # 2. Planning (Simple Router or LLM Router)
    if "draw" in user_instruction or "diagram" in user_instruction:
        action = action_draw
    elif "summarize" in user_instruction or "explain" in user_instruction:
        action = action_summarize
    else:
        # Default to chat/summary
        action = action_summarize
        
    # 3. Action
    result_card = await action(input=context, instruction=user_instruction)
    
    return result_card
```

⸻

### 3.7 初始化笔记（左侧 auto-notes）

当用户上传 PDF 后，可以提供一个按钮：
	•	Generate overview notes

后端逻辑：
1. 读取 PDF 全文（或前 N 页，视 token 限制而定）。
2. 调用 Gemini 生成结构化的“全文总结”。
3. **调用 Gemini 生成一张基于文档内容的“信息图”或“封面图”。**
4. 返回 1 张或多张 `NoteCard` (type='overview')，其中包含生成的图片。
5. 前端收到后，直接更新到左侧 `NotebookPanel` 的状态中。用后端接口：
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

