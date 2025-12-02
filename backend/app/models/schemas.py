from pydantic import BaseModel
from typing import List, Optional, Any

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
