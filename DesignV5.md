# 📚 PDF 智能阅读 Agent V5（持久化记忆 + 体验优化）

> 一个带「记忆」的 PDF 学术阅读 Agent：
> - 左侧：自动生成 & 可收藏的 **笔记区**
> - 中间：可缩放的 **PDF 阅读区**
> - 右侧：基于多模型 AI 的 **交互面板 / Agent 控制台**
> - **V4 新增**：右上角 **模型选择器** - 支持 Google Gemini、DeepSeek、ByteDance Doubao 三种 AI 模型动态切换
> - **V5 新增**：**持久化记忆** - 重新上传相同 PDF 自动恢复笔记和对话历史；**体验优化** - 修复卡片弹窗显示问题

---

## 0. 功能概览（V5 版本 - 持久化记忆）

### 🆕 V5 核心新功能

#### 持久化记忆 (Persistent Memory)
- **文件指纹识别**：通过 MD5 哈希识别相同文件，避免重复解析
- **状态自动恢复**：重新上传已读过的 PDF 时，自动恢复之前的：
  - 左侧笔记 (Notebook)
  - 右侧对话历史 (Chat History)
  - 文档元数据 (Metadata)

#### 体验优化
- **卡片弹窗修复**：修复了点击卡片导致黑屏的问题，优化了弹窗的层级和显示逻辑
- **对话同步**：前端对话记录实时同步至后端存储

### 🆕 V4 核心新功能回顾

#### 多模型架构支持
- **统一接口**：所有模型通过 `MultiModelClient` 统一管理
- **动态切换**：用户可实时切换模型，无需重启应用  
- **能力标识**：UI 清晰显示每个模型的特殊能力（如图像生成）

#### 交互式模型选择器
- **下拉菜单**：点击右上角模型显示区的下拉箭头
- **模型信息**：每个选项显示提供商图标、模型名称、能力标签
- **实时切换**：选择后立即生效，影响后续所有 AI 交互

### 🎯 用户视角

1. 用户上传一篇 PDF 论文。
2. **【V4 新增】** 用户可以在右上角的**模型选择器**中选择 AI 模型：
   - **Google Gemini 2.0 Flash** - 支持文本生成和图像生成
   - **DeepSeek Chat** - 高质量文本生成，适合深度分析  
   - **DeepSeek Reasoner** - 专业推理模型，适合逻辑分析
   - **ByteDance Doubao** - 快速响应，适合日常问答
3. 系统自动：
   - 解析 PDF
   - **立即**使用选定模型对全文进行**全面总结**
   - **（Gemini 独有）**调用 Gemini Flash-Image 为该文档生成一张**封面图/概念图**
   - 自动将总结和图片生成一张或多张「卡片」，直接加入左侧笔记区。
3. 用户在中间窗口正常阅读 PDF（支持翻页 & 缩放）。
4. 用户在右侧 Agent 控制台：
   - **上方**：显示当前页码、**当前选择的 AI 模型**等上下文信息。
   - **中间**：一个可滚动的**对话/聊天区域**。用户可以在输入框提问（如"解释这段话"），系统使用当前选定模型回答，结果以「卡片」形式出现在对话流中，支持"Add to Notebook"。
   - **底部**：放置快捷工具按钮（`Summarize this page`, `Draw diagram`），点击后使用当前模型生成结果。
5. 系统调用 Agent backend：
   - 读取对应页内容
   - 使用选定模型生成 **文字解释**，或调用 Gemini 生成 **算法原理图 (Image)**
   - 返回作为「卡片」展示在右侧
   - 用户可以点「Add to Notebook」把右侧卡片加入左侧笔记区
6. **【V4 新增】** 用户可以随时切换 AI 模型，体验不同模型的分析风格和能力特长。
7. 最后用户可以点击「Export Markdown」，把左侧笔记导出为一份 `.md` 文件，作为这篇论文的阅读笔记。

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
- **【V4 新增】模型选择**：根据用户选择的模型和任务类型，智能路由到合适的AI服务。
- **能力适配**：自动适配不同模型的能力特性（如 Gemini 的图像生成、DeepSeek 的推理能力）。

### 1.3 Action (行动层)
定义 Agent 可调用的通用工具函数（Tools），支持多模态输入：
- **`action_summarize(input: Any)`**：对输入内容（文本/图片）进行总结或解释。
- **`action_draw(input: Any)`**：根据输入内容（文本/图片）生成可视化图像。
- **`action_search(query: str)`**：(可选) 检索文档内的特定信息。

### 1.4 Memory (记忆层)
- **Short-term (Context)**：当前的对话历史、当前页面的内容。
- **Long-term (Storage)**：
  - **Document Memory**：已生成的笔记卡片、文档摘要、**【V5】对话历史**。
  - **File Identity**：**【V5】基于文件哈希的文档映射表**。
  - **User Memory (Future)**：用户的阅读偏好、风格习惯。

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
	•	**【V4 新增】Top-Right**: 模型选择器下拉菜单
	    •	显示当前选择的 AI 模型（Google/DeepSeek/Doubao 图标 + 模型名称）
	    •	点击下拉箭头显示所有可用模型选项
	    •	每个选项显示：提供商图标、模型名称、能力标签（如 "🖼️ Image" 表示支持图像生成）
	•	**Top**: 显示当前文档 & 页信息 (Context)
	•	**Middle**: 滚动聊天窗口 (Chat History)
	    •	用户消息（气泡）
	    •	Agent 回复（**卡片形式**），每个卡片带「Add to Notebook」按钮
	    •	【V4 新增】卡片头部显示生成该内容的模型信息
	•	**Bottom**: 交互输入区
	    •	文本输入框 + 发送按钮
	    •	快捷工具栏：[Summarize Page] [Draw Diagram]
	    •	【V4 新增】所有操作都使用当前选择的模型执行

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
POST /api/agent/init-notes -> 对整篇文档生成"关键笔记"（左侧初始笔记）
POST /api/agent/run-task   -> 针对 doc_id + page + task_type 生成卡片

**【V4 新增】模型管理 API：**
GET  /api/models           -> 获取所有可用模型列表
GET  /api/models/current   -> 获取当前选择的模型
POST /api/models/set       -> 设置当前使用的模型

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
  "notes": [ /* 笔记卡片列表 */ ],
  "chat_history": [ /* 【V5】对话历史列表 */ ]
}
```

**【V5】文件映射表**
```json
# data/file_map.json
{
  "md5_hash_string": "doc_id_string",
  ...
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

### 3.4 【V4 新增】多模型 Client 架构

V4 版本采用统一的多模型架构，支持动态切换不同的 AI 模型：

#### 3.4.1 MultiModelClient（统一接口）
```python
class MultiModelClient:
    def __init__(self):
        self.current_model = "gemini-2.0-flash"
        self.clients = {}
        self._initialize_clients()
    
    def get_current_client(self) -> BaseAIClient:
        return self.clients.get(self.current_model)
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        client = self.get_current_client()
        return await client.generate_text(prompt, **kwargs)
    
    async def generate_image(self, prompt: str) -> bytes:
        # 只有 Gemini 支持图像生成
        if "gemini" not in self.current_model:
            raise NotImplementedError("Current model does not support image generation")
        client = self.clients["gemini-2.0-flash"]
        return await client.generate_image(prompt)
```

#### 3.4.2 具体模型 Client 实现
```python
**Google Gemini Client:**
```python
class GeminiClient(BaseAIClient):
    def __init__(self, api_key: str):
        self.api_key = api_key
        # 初始化 Gemini client

    async def generate_text(self, prompt: str, **kwargs) -> str:
        # 调用 Gemini 2.0 Flash API
        response = await self.client.generate_content(prompt)
        return response.text

    async def generate_image(self, prompt: str) -> bytes:
        # 使用 Gemini Flash-Image 生成图片
        response = await self.client.generate_content(
            model="gemini-2.0-flash-image", 
            contents=[prompt]
        )
        return response.parts[0].inline_data
```

**DeepSeek Client:**
```python
class DeepSeekClient(BaseAIClient):
    def __init__(self, api_key: str):
        self.api_key = api_key
        # 初始化 OpenAI 兼容的 DeepSeek client
        
    async def generate_text(self, prompt: str, model: str = "deepseek-chat", **kwargs) -> str:
        # 支持 deepseek-chat 和 deepseek-reasoner
        response = await self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
```

**ByteDance Doubao Client:**
```python
class DoubaoClient(BaseAIClient):
    def __init__(self, api_key: str):
        self.api_key = api_key
        # 初始化字节跳动 ARK API client
        
    async def generate_text(self, prompt: str, **kwargs) -> str:
        # 调用字节跳动豆包模型
        response = await self.client.chat(prompt)
        return response.output.text
```
**【V4 新增】模型管理服务:**
```python
class ModelManager:
    def __init__(self):
        self.available_models = {
            "gemini-2.0-flash": {"provider": "Google", "supports_image": True},
            "deepseek-chat": {"provider": "DeepSeek", "supports_image": False},
            "deepseek-reasoner": {"provider": "DeepSeek", "supports_image": False},
            "doubao": {"provider": "ByteDance", "supports_image": False}
        }
        
    def get_available_models(self) -> dict:
        return self.available_models
        
    def set_current_model(self, model_name: str):
        if model_name in self.available_models:
            # 更新当前使用的模型
            pass
```

⸻

### 3.5 【V4 更新】Agent Action Tools (多模型工具封装)

V4 版本将工具抽象为支持多模型的通用 Action 接口。

#### 1. `action_summarize(input: Union[str, List[Image]]) -> NoteCard`
- **功能**：对输入的内容进行理解、总结或解释。
- **【V4 新增】模型支持**：根据当前选择的模型调用相应的 AI 服务。
- **Input**：
  - `text`: 页面文本、用户问题。
  - `images`: PDF 页面截图（仅 Gemini 可直接处理图像）。
- **Output**：结构化的文本总结（Markdown）。
- **实现逻辑**：
  ```python
  async def action_summarize(input_content, context=None):
      # 【V4 新增】使用当前选择的模型
      client = multi_model_client.get_current_client()
      prompt = "Analyze and summarize the following content..."
      response = await client.generate_text(prompt)
      return create_card(type="summary", content=response, model=client.model_name)
  ```

#### 2. `action_draw(input: Union[str, List[Image]]) -> NoteCard`
- **功能**：根据输入内容生成可视化图像（图表、概念图、封面）。
- **【V4 限制】模型支持**：仅 Gemini 模型支持图像生成，其他模型将返回文字描述。
- **Input**：
  - `text`: 文本描述、算法步骤。
  - `images`: 草图、需要重绘的图表（仅 Gemini 支持）。
- **Output**：生成的图片 URL 或文字描述。
- **实现逻辑**：
  ```python
  async def action_draw(input_content):
      client = multi_model_client.get_current_client()
      
      # 【V4 新增】检查模型能力
      if hasattr(client, 'generate_image'):
          # Gemini: 生成真实图片
          image_prompt = await client.generate_text("Describe a visualization for:" + input_content)
          image_bytes = await client.generate_image(image_prompt)
          return create_card(type="image", imageUrl=save(image_bytes), model=client.model_name)
      else:
          # 其他模型: 生成图表描述
          description = await client.generate_text(f"Describe a detailed diagram for: {input_content}")
          return create_card(type="text", content=description, model=client.model_name)
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
2. 调用 指定的模型 生成结构化的“全文总结”。
3. **调用 指定的模型 生成一张基于文档内容的“信息图”或“封面图”。**
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

## 5. 【V4 已完成】开发步骤回顾

### 5.1 ✅ 基础架构 (已完成)
- **前端**: React + Vite 项目架构
- **后端**: FastAPI 服务架构
- **通信**: 前后端 API 接口联通

### 5.2 ✅ 核心功能 (已完成)  
- **PDF 处理**: 上传、解析、翻页、缩放
- **Agent 交互**: Chat UI、快捷指令、卡片系统
- **笔记管理**: NotebookPanel、收藏、导出 Markdown

### 5.3 🆕 V4 多模型功能 (已完成)

#### 后端架构升级
- ✅ **MultiModelClient**: 统一的多模型客户端架构
- ✅ **模型支持**: Google Gemini 2.0 Flash、DeepSeek Chat/Reasoner、ByteDance Doubao
- ✅ **API 接口**: `/api/models`、`/api/models/current`、`/api/models/set`
- ✅ **能力适配**: 自动适配不同模型的特性（如图像生成）

#### 前端交互升级  
- ✅ **ModelSelector 组件**: 交互式下拉模型选择器
- ✅ **UI 集成**: 右上角模型显示和切换功能
- ✅ **实时切换**: 用户可随时切换模型，立即生效
- ✅ **视觉标识**: 提供商图标、模型信息、能力标签显示

#### 环境配置
- ✅ **依赖管理**: 更新 requirements.txt，支持多模型依赖
- ✅ **环境变量**: 配置多个 AI 服务的 API 密钥
- ✅ **文档完善**: README_V4.md 提供详细的配置和使用指南

### 5.4 部署状态
当前 V4 版本已完全实现并可部署使用，用户可以：
1. 🔄 在右上角动态切换 AI 模型
2. 📝 使用不同模型进行文档分析和对话
3. 🖼️ 使用 Gemini 生成图像（其他模型提供文字描述）
4. 💾 保存和导出多模型生成的分析结果

## 6. 【V5 已完成】开发步骤回顾

### 6.1 ✅ 持久化记忆 (已完成)
- **后端**:
  - `DocumentService`: 增加 MD5 哈希计算与 `file_map.json` 映射
  - `MemoryService`: 增加 `chat_history` 存储支持
  - `API`: 更新 `upload-pdf` 返回恢复状态，新增 `save_chat_history` 接口
- **前端**:
  - `App.jsx`: 支持加载 `chat_history` 并传递给 `AgentPanel`
  - `AgentPanel.jsx`: 支持初始化消息列表，增加自动保存机制

### 6.2 ✅ 体验优化 (已完成)
- **功能移除**: 移除所有弹窗功能，简化用户交互
- **记忆增强**: 确保聊天记录完整保存 AI 回复内容（包括卡片数据）
- **交互**: 优化文件上传后的状态恢复提示

⸻

## 7. 【V4 专项】配置与部署指南

### 6.1 环境配置

V4 版本需要配置多个 AI 服务的 API 密钥：

```bash
# backend/.env
GEMINI_API_KEY=your_gemini_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here  
ARK_API_KEY=your_bytedance_ark_api_key_here
```

### 6.2 API 密钥获取

#### Google Gemini
1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 创建项目并获取 API Key
3. 确保启用 Gemini 2.0 Flash 和 Flash-Image 模型

#### DeepSeek
1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册账号并创建 API Key
3. 支持 `deepseek-chat` 和 `deepseek-reasoner` 模型

#### ByteDance Doubao (豆包)
1. 访问 [火山引擎 ARK 平台](https://console.volcengine.com/ark/)
2. 开通豆包服务并获取 API Key
3. 配置模型访问权限

### 6.3 依赖安装

```bash
# 后端依赖
cd backend
pip install -r requirements.txt

# 新增V4依赖
pip install openai volcenginesdkarkruntime
```

### 6.4 V4 特性验证

启动服务后，验证多模型功能：

1. **模型列表**: `GET /api/models` - 检查所有模型是否正确加载
2. **模型切换**: `POST /api/models/set` - 测试模型切换功能  
3. **前端界面**: 右上角应显示模型选择器下拉菜单
4. **功能测试**: 分别使用不同模型测试文本生成和图像生成

### 6.5 使用建议

- **Gemini 2.0 Flash**: 适合需要图像生成的场景，综合能力强
- **DeepSeek Chat**: 适合深度文本分析，回答质量高
- **DeepSeek Reasoner**: 适合逻辑推理和复杂问题解答
- **ByteDance Doubao**: 适合快速响应的日常问答

---

## 7. 后续可以扩展的方向

### 7.1 已完成功能 (V4)
- ✅ 多模型支持（Google Gemini、DeepSeek、ByteDance Doubao）
- ✅ 交互式模型选择器
- ✅ 统一的多模型客户端架构
- ✅ 模型能力自适应（图像生成等）

### 7.2 未来扩展方向
- **高级交互**：
  - 支持「公式级解释」：用户点击 PDF 中公式，传坐标给后端
  - 支持「高亮段落 → 右键菜单 → Explain this part」
- **记忆增强**：
  - 对每篇文档构建概念图 / 术语表
  - 跨文档的知识关联和引用
- **智能决策**：
  - 更智能的 Planner：由 AI 自动决定调用哪些工具和模型
  - 基于用户习惯的模型推荐
- **多模态扩展**：
  - 支持更多图像生成模型（DALL-E、Midjourney 等）
  - 语音输入和输出功能

