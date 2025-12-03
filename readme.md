# PDF 学术阅读 Agent V6.1

一个基于 AI 的智能 PDF 学术论文阅读助手，支持多模型切换和持久化记忆，帮助研究者高效分析和理解学术文献。

## ✨ 特性

### 🎯 核心功能
- **智能文档解析**: 自动提取PDF文档内容和结构
- **多模型支持**: 集成Google Gemini、DeepSeek、ByteDance Doubao多种AI模型
- **持久化记忆**: 基于文件MD5哈希的智能记忆系统，重新上传相同PDF自动恢复笔记和对话历史
- **页面级摘要**: 针对每页内容生成精准摘要
- **图表生成**: 根据文本内容自动绘制流程图和示意图（Gemini模型独有）
- **智能问答**: 基于文档内容的上下文对话
- **笔记管理**: 自动保存和组织分析结果

### 🎨 用户界面
- **现代化设计**: 深色主题 + Glassmorphism 风格
- **三栏布局**: 笔记面板 / PDF阅读器 / AI对话区
- **全屏弹窗系统**: Portal渲染的专业级弹窗，支持图片预览和缩放
- **高级图片查看**: 70%大图显示、滚轮缩放(0.5x-5x)、拖拽平移、缩放控制面板
- **响应式交互**: 卡片展开/收缩、智能滚动
- **实时反馈**: 加载状态、进度指示

### 🤖 AI 能力
- **多模型架构**: 统一接口支持Google Gemini 2.0/3.0、DeepSeek Chat/Reasoner、ByteDance Doubao
- **动态模型切换**: 右上角交互式模型选择器，实时切换不同AI模型
- **多模态理解**: 文本 + 图像内容分析
- **智能规划**: 自动判断用户意图（文本/图像/混合）
- **持久化记忆**: 基于MD5文件指纹的智能记忆系统
- **上下文记忆**: 维持对话历史和页面上下文

## 🧠 Agent 认知架构

本项目基于通用 Agent 的四大核心能力构建，实现了从感知到行动的完整闭环：

### 👁️ Perception (感知)
- **用户感知**: 实时监听前端交互（点击、滚动、缩放、拖拽），捕捉用户意图。
- **文档感知**: 后端 `DocumentService` 深度解析 PDF，提取文本、图像坐标和文档结构。
- **多模态输入**: 支持文本指令和视觉反馈的混合输入。

### 🧠 Planning (规划)
- **意图识别**: `AgentService` 内置规划层，分析用户指令（如"解释这段" vs "画个图"）。
- **动态路由**: 根据任务需求智能选择模型（Gemini 处理视觉任务，DeepSeek 处理深度文本）。
- **任务编排**: 将复杂请求拆解为"阅读 -> 思考 -> 生成 -> 绘图"的执行序列。

### 💾 Memory (记忆)
- **短期记忆 (Short-term)**: `MemoryService` 维护当前的对话上下文和页面阅读状态。
- **长期记忆 (Long-term)**: 基于 MD5 文件指纹的持久化存储，自动恢复历史笔记和对话。
- **知识库**: 结构化的 `NoteCard` 系统，将非结构化对话转化为结构化知识。

### 🛠️ Action (行动)
- **Summarize**: 调用 LLM 对特定页面或段落进行深度总结。
- **Draw**: 调用生成式模型绘制概念图、流程图或数据可视化。
- **Memory Ops**: 自动化的笔记插入、删除、更新和导出（Markdown/ZIP）。

## 🚀 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- Conda (推荐使用 Anaconda 或 Miniconda)
- 至少一个AI模型的API Key：
  - Google Gemini API Key (支持图像生成)
  - DeepSeek API Key (高质量文本分析)
  - ByteDance ARK API Key (快速响应)

### 安装步骤

#### 1. 克隆项目
```bash
git clone https://github.com/OuyangRuyi/pdf_reader.git
cd pdf_reader
```

#### 2. 后端设置
```bash
cd backend

# 创建conda环境
conda create -n pdf_reader python=3.12 -y
conda activate pdf_reader

# 安装依赖
pip install -r requirements.txt
```

创建 `.env` 文件并配置API密钥：
```bash
# Google Gemini (支持文本生成和图像生成)
export GEMINI_API_KEY=your_gemini_api_key_here

# DeepSeek (高质量文本分析，可选)
export DEEPSEEK_API_KEY=your_deepseek_api_key_here

# ByteDance Doubao (快速响应，可选)
export ARK_API_KEY=your_bytedance_ark_api_key_here
```

#### 3. 前端设置
```bash
cd frontend
npm install
```

#### 4. 启动服务

**后端服务** (Terminal 1):
```bash
cd backend
conda activate pdf_reader
uvicorn app.main:app --reload --port 8000
```

**前端服务** (Terminal 2):
```bash
cd frontend
npm run dev
```

访问 `http://localhost:5173` 开始使用。

## 📖 使用指南

### 基础操作
1. **上传PDF**: 点击中央上传区域选择PDF文件
2. **自动分析**: 上传后自动生成文档概览（支持记忆恢复）
3. **模型切换**: 右上角选择AI模型（Gemini/DeepSeek/Doubao）
4. **页面导航**: 使用底部工具栏切换页面和缩放
5. **智能对话**: 在右侧输入问题或使用快捷按钮

### 高级功能
- **模型选择**: 根据需求切换不同AI模型
  - **Gemini**: 综合能力强，支持图像生成
  - **DeepSeek**: 深度文本分析，逻辑推理
  - **Doubao**: 快速响应，日常问答
- **持久化记忆**: 相同PDF重新上传自动恢复历史
- **全屏弹窗**: 点击卡片查看详细内容和大图
- **图片缩放**: 在弹窗中支持滚轮缩放和拖拽平移

### 快捷功能
- **Summarize**: 快速总结当前页面内容
- **Draw Diagram**: 根据内容生成可视化图表（仅Gemini）
- **自由提问**: 输入任何关于文档的问题

### 笔记管理
- **自动保存**: AI回复自动保存为笔记卡片
- **弹窗查看**: 点击卡片打开全屏弹窗查看详细内容
- **图片预览**: 支持大图显示、缩放和拖拽
- **问题追踪**: 每张卡片显示触发的用户问题
- **导出功能**: 支持ZIP格式导出（包含Markdown文件和图片文件夹）

## 🏗️ 技术架构

### 后端 (FastAPI + Python)
```
backend/
├── app/
│   ├── main.py              # 主应用入口
│   ├── models/              # 数据模型
│   │   └── schemas.py       # API数据模型
│   ├── services/            # 业务逻辑
│   │   ├── agent_service.py # AI Agent核心服务
│   │   ├── document_service.py # 文档处理和记忆管理
│   │   ├── memory_service.py # 持久化记忆服务
│   │   ├── gemini_client.py # Gemini API客户端
│   │   └── multi_model_client.py # 多模型统一客户端
│   └── utils/               # 工具函数
├── data/
│   ├── docs/                # 文档元数据存储
│   ├── uploads/             # 文件上传目录
│   └── file_map.json        # 文件MD5映射表
└── requirements.txt
```

### 前端 (React + Vite)
```
frontend/
├── src/
│   ├── components/          # React组件
│   │   ├── NotebookPanel.jsx # 笔记面板
│   │   ├── PDFViewer.jsx    # PDF阅读器
│   │   ├── AgentPanel.jsx   # AI对话面板
│   │   ├── ModelSelector.jsx # 模型选择器
│   │   └── Modal/           # 弹窗组件
│   │       ├── FullscreenModal.jsx # 全屏弹窗
│   │       └── FullscreenModal.css # 弹窗样式
│   ├── services/            # API服务
│   │   └── api.js          # API接口封装
│   ├── App.jsx             # 主应用组件
│   ├── App.css             # 样式文件
│   └── main.jsx            # 应用入口
└── package.json
```

### 核心依赖
- **后端**: FastAPI, google-generativeai, openai, PyMuPDF, Pillow, volcenginesdkarkruntime
- **前端**: React, react-pdf, react-markdown, Lucide React, JSZip, Vite

## 🎨 设计系统

### 颜色主题
- **背景**: Zinc 950 深色渐变
- **主色**: Blue 500 (#3b82f6)
- **文本**: Zinc 100/400/500 层次
- **强调**: Violet 500, Emerald 500

### 布局规范
- **三栏布局**: 300px | flex-1 | 350px
- **高度控制**: 严格100vh约束
- **滚动区域**: 每栏独立滚动
- **响应式**: 最小宽度1024px

## 🧪 API 文档

### 主要端点
- `POST /upload/` - 上传PDF文件（支持记忆恢复）
- `POST /agent/task` - 执行AI任务
- `POST /agent/chat` - 对话交互
- `POST /agent/save-chat-history` - 保存对话历史
- `DELETE /agent/chat/{message_id}` - 删除聊天消息
- `GET /docs/{doc_id}/meta` - 获取文档元数据
- `GET /docs/{doc_id}/pdf` - 获取PDF文件
- `GET /models` - 获取可用模型列表
- `POST /models/switch` - 切换当前模型

详细API文档: `http://localhost:8000/docs`

## 📝 开发历程

### ✅ V6 已完成功能 (当前版本)
- ✅ **全屏弹窗系统**: Portal渲染的专业级弹窗组件
- ✅ **高级图片查看**: 70%大图显示、滚轮缩放、拖拽平移
- ✅ **缩放控制面板**: ±按钮、百分比显示、关闭按钮
- ✅ **响应式设计**: 移动端适配和多屏幕支持
- ✅ **文本与图片分离**: 文本左对齐，图片独立居中

### ✅ V5 已完成功能
- ✅ **持久化记忆**: 基于MD5哈希的文件指纹识别
- ✅ **状态恢复**: 重新上传相同PDF自动恢复笔记和对话
- ✅ **记忆管理**: 聊天历史的保存和删除功能

### ✅ V4 已完成功能 
- ✅ **多模型支持**: Google Gemini、DeepSeek、ByteDance Doubao
- ✅ **模型切换界面**: 右上角交互式模型选择器
- ✅ **统一客户端**: MultiModelClient架构
- ✅ **能力适配**: 不同模型的特性自动适配

### 🚀 未来规划

### 🎯 功能扩展
- [ ] **批量处理**: 同时上传和分析多个PDF文件
- [ ] **文档比较**: 对比两篇论文的异同点
- [ ] **引用分析**: 自动提取和分析文献引用
- [ ] **关键词标签**: 自动生成文档标签和关键词云
- [ ] **搜索功能**: 全文搜索和语义搜索

### 🎨 用户体验优化
- [ ] **主题切换**: 支持浅色主题
- [ ] **字体大小调节**: 可调节阅读字体大小
- [ ] **快捷键支持**: 键盘快捷键操作
- [ ] **拖拽上传**: 支持拖拽PDF文件上传

### 🔧 技术改进
- [ ] **Docker部署**: 容器化部署选项
- [ ] **数据库集成**: 数据库存储
- [ ] **用户系统**: 登录注册和个人空间
- [ ] **API优化**: 限流、缓存、错误重试
- [ ] **性能监控**: 模型响应时间和质量指标

### 📊 分析能力
- [ ] **表格理解**: 更好的表格数据提取和分析
- [ ] **公式识别**: 数学公式的识别和解释
- [ ] **图表解读**: 自动分析论文中的图表
- [ ] **多语言支持**: 中英文混合文档处理

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Google Gemini](https://deepmind.google/technologies/gemini/) - 强大的AI模型支持
- [React PDF](https://github.com/wojtekmaj/react-pdf) - PDF渲染组件
- [Lucide React](https://lucide.dev/) - 精美的图标库
- [FastAPI](https://fastapi.tiangolo.com/) - 现代Python Web框架

---

如有问题或建议，请提交 [Issue](https://github.com/OuyangRuyi/pdf_reader/issues) 或联系开发者。
