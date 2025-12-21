from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class NoteCard(BaseModel):
    id: str
    type: str  # 'overview', 'page_summary', 'equation_explanation', 'diagram'
    title: str
    content: str
    page: Optional[int] = None
    imageUrl: Optional[str] = None
    createdAt: str

class DocMeta(BaseModel):
    doc_id: str
    title: str
    num_pages: int
    created_at: str
    notes: List[NoteCard] = []
    chat_history: List[Any] = []
    embedding_status: str = "not_started" # 'not_started', 'processing', 'completed', 'failed'
    is_rag_only: bool = False
    toc: List[Dict[str, Any]] = []
    figures: List[Dict[str, Any]] = []

class RunTaskRequest(BaseModel):
    doc_id: str
    page: int
    task_type: str  # 'summarize_page', 'draw_diagram_page'

class TaskResponse(BaseModel):
    cards: List[NoteCard]

class ChatRequest(BaseModel):
    doc_id: str
    page: int
    question: str
    history: List[Any] = []

class InitNotesRequest(BaseModel):
    doc_id: str
    type: str = 'both'  # 'summary', 'diagram', or 'both'

class ModelInfo(BaseModel):
    name: str
    provider: str
    supports_image: bool
    model_id: str

class AvailableModelsResponse(BaseModel):
    models: dict  # {model_id: ModelInfo}
    current_model: str

class SetModelRequest(BaseModel):
    model_id: str

class ModelResponse(BaseModel):
    success: bool
    current_model: dict  # ModelInfo

# Config Schemas
class AppConfig(BaseModel):
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_BASE_URL: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: Optional[str] = None
    ARK_API_KEY: Optional[str] = None
    ARK_BASE_URL: Optional[str] = None
    LANGUAGE: str = "en"  # 'en' or 'zh'

class ConfigStatusResponse(BaseModel):
    is_configured: bool
    config: Optional[AppConfig] = None

# RAG 相关模型（新增，不影响现有代码）
class RAGQueryRequest(BaseModel):
    question: str

class RAGContextChunk(BaseModel):
    """检索到的文档片段"""
    doc_id: str
    chunk: str
    similarity_score: float

class RAGQueryResponse(BaseModel):
    id: str
    answer: str
    question: str
    context_chunks: List[RAGContextChunk] = []  # 新增：检索到的上下文
    total_docs_searched: int = 0  # 新增：搜索的文档数量
    debug_prompt: Optional[str] = None  # 新增：用于调试的 prompt

# Personal Memory / User Profile
class UserProfile(BaseModel):
    interests: List[str] = []  # 自动提取的兴趣点
    focus_areas: List[str] = []  # 核心关注领域 (如: 方法论, 实验结果)
    custom_instructions: str = ""  # 用户自定义指令
    last_updated: str

class ActiveReadingRequest(BaseModel):
    doc_id: str
    page: int

class ActiveReadingResponse(BaseModel):
    cards: List[Any]

# New Schemas for Skim, Figures, and References
class SkimRequest(BaseModel):
    doc_id: str

class ResolveReferenceRequest(BaseModel):
    doc_id: str
    ref_text: str

class AnalyzeFigureRequest(BaseModel):
    doc_id: str
    figure_data: Dict[str, Any]

class ActiveReadingCard(BaseModel):
    question: str
    reason: str
    type: str

class ActiveReadingResponse(BaseModel):
    cards: List[ActiveReadingCard]
