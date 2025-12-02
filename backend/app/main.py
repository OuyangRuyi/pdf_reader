from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from typing import List, Any
import os

from .services.document_service import DocumentService
from .services.memory_service import MemoryService
from .services.agent_service import AgentService
from .models.schemas import DocMeta, RunTaskRequest, TaskResponse, NoteCard, ChatRequest, InitNotesRequest, AvailableModelsResponse, SetModelRequest, ModelResponse

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
doc_service = DocumentService()
memory_service = MemoryService()
agent_service = AgentService()

# Mount uploads directory to serve PDFs
os.makedirs("data/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"message": "PDF Reader Agent API is running"}

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        doc_id = doc_service.save_upload(file)
        
        # Check if meta exists (restored)
        existing_meta = memory_service.load_doc_meta(doc_id)
        if existing_meta:
            return {
                "doc_id": doc_id, 
                "num_pages": existing_meta.num_pages,
                "restored": True
            }
        
        info = doc_service.get_doc_info(doc_id)
        
        # Initialize meta
        meta = DocMeta(
            doc_id=doc_id,
            title=info["title"],
            num_pages=info["num_pages"],
            created_at=datetime.now().isoformat(),
            notes=[],
            chat_history=[]
        )
        memory_service.save_doc_meta(meta)
        
        return {"doc_id": doc_id, "num_pages": info["num_pages"], "restored": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/doc/{doc_id}")
def get_doc(doc_id: str):
    meta = memory_service.load_doc_meta(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Document not found")
    return meta

@app.post("/api/agent/run-task", response_model=TaskResponse)
async def run_task(req: RunTaskRequest):
    cards = await agent_service.run_task(req.doc_id, req.page, req.task_type)
    return {"cards": cards}

@app.post("/api/agent/init-notes", response_model=TaskResponse)
async def init_notes(req: InitNotesRequest):
    cards = await agent_service.init_notes(req.doc_id, req.type)
    # Automatically save these notes to memory
    for card in cards:
        memory_service.add_note(req.doc_id, card)
    return {"cards": cards}

@app.post("/api/agent/chat", response_model=NoteCard)
async def chat(req: ChatRequest):
    card = await agent_service.chat(req.doc_id, req.page, req.question, req.history)
    return card

@app.post("/api/doc/{doc_id}/chat_history")
def save_chat_history(doc_id: str, history: List[Any]):
    memory_service.update_chat_history(doc_id, history)
    return {"status": "success"}

@app.delete("/api/doc/{doc_id}/chat_history/{message_index}")
def delete_chat_message(doc_id: str, message_index: int):
    memory_service.delete_chat_message(doc_id, message_index)
    return {"status": "success"}

@app.post("/api/doc/{doc_id}/clear_chat")
def clear_chat_history(doc_id: str):
    memory_service.clear_chat_history(doc_id)
    return {"status": "success"}

@app.post("/api/doc/{doc_id}/notes")
def add_note(doc_id: str, note: NoteCard):
    memory_service.add_note(doc_id, note)
    return {"status": "success"}

@app.delete("/api/doc/{doc_id}/notes/{note_id}")
def delete_note(doc_id: str, note_id: str):
    memory_service.remove_note(doc_id, note_id)
    return {"status": "success"}

# Model Management APIs
@app.get("/api/models", response_model=AvailableModelsResponse)
def get_available_models():
    """Get all available AI models"""
    available_models = agent_service.get_available_models()
    current_model_info = agent_service.get_current_model_info()
    
    return AvailableModelsResponse(
        models=available_models,
        current_model=current_model_info.get("model_id", "unknown")
    )

@app.post("/api/models/set", response_model=ModelResponse)
def set_current_model(request: SetModelRequest):
    """Switch to a different AI model"""
    success = agent_service.set_current_model(request.model_id)
    current_model_info = agent_service.get_current_model_info()
    
    return ModelResponse(
        success=success,
        current_model=current_model_info
    )

@app.get("/api/models/current", response_model=dict)
def get_current_model():
    """Get current model information"""
    return agent_service.get_current_model_info()

@app.get("/api/test-model")
async def test_model():
    """Test current model with a simple request"""
    try:
        result = await agent_service.ai_client.generate_text("Hello, respond with 'Model is working correctly'")
        return {"status": "success", "response": result}
    except Exception as e:
        return {"status": "error", "error": str(e)}
