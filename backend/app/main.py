from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from datetime import datetime
import os

from .services.document_service import DocumentService
from .services.memory_service import MemoryService
from .services.agent_service import AgentService
from .models.schemas import DocMeta, RunTaskRequest, TaskResponse, NoteCard, ChatRequest, InitNotesRequest

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
        info = doc_service.get_doc_info(doc_id)
        
        # Initialize meta
        meta = DocMeta(
            doc_id=doc_id,
            title=info["title"],
            num_pages=info["num_pages"],
            created_at=datetime.now().isoformat(),
            notes=[]
        )
        memory_service.save_doc_meta(meta)
        
        return {"doc_id": doc_id, "num_pages": info["num_pages"]}
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
    cards = await agent_service.init_notes(req.doc_id)
    # Automatically save these notes to memory
    for card in cards:
        memory_service.add_note(req.doc_id, card)
    return {"cards": cards}

@app.post("/api/agent/chat", response_model=NoteCard)
async def chat(req: ChatRequest):
    card = await agent_service.chat(req.doc_id, req.page, req.question, req.history)
    return card

@app.post("/api/doc/{doc_id}/notes")
def add_note(doc_id: str, note: NoteCard):
    memory_service.add_note(doc_id, note)
    return {"status": "success"}

@app.delete("/api/doc/{doc_id}/notes/{note_id}")
def delete_note(doc_id: str, note_id: str):
    memory_service.remove_note(doc_id, note_id)
    return {"status": "success"}
