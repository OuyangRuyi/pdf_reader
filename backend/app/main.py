from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from typing import List, Any
import os

from .services.document_service import DocumentService
from .services.memory_service import MemoryService
from .services.agent_service import AgentService
from .services.config_service import ConfigService
from .services.embedding_service import EmbeddingService
from .services.rag_service import RAGService
from .models.schemas import DocMeta, RunTaskRequest, TaskResponse, NoteCard, ChatRequest, InitNotesRequest, AvailableModelsResponse, SetModelRequest, ModelResponse, AppConfig, ConfigStatusResponse, RAGQueryRequest, RAGQueryResponse, UserProfile, ActiveReadingRequest, ActiveReadingResponse, SkimRequest, ResolveReferenceRequest, AnalyzeFigureRequest

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
config_service = ConfigService()
doc_service = DocumentService()
memory_service = MemoryService()
agent_service = AgentService()
embedding_service = EmbeddingService()
rag_service = RAGService(ai_client=agent_service.ai_client)

# Mount uploads directory to serve PDFs
os.makedirs("data/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"message": "PDF Reader Agent API is running"}

# Config APIs
@app.get("/api/config/status", response_model=ConfigStatusResponse)
def get_config_status():
    """Check if the application is configured and return current config (masked)"""
    is_configured = config_service.is_configured()
    config = config_service.config.copy()
    
    # Mask API keys for security
    for key in config:
        if "KEY" in key and config[key]:
            config[key] = config[key][:4] + "*" * (len(config[key]) - 8) + config[key][-4:] if len(config[key]) > 8 else "****"
            
    return ConfigStatusResponse(
        is_configured=is_configured,
        config=AppConfig(**config)
    )

@app.post("/api/config/save")
def save_config(config: AppConfig):
    """Save application configuration"""
    # If a key is masked (contains *), don't overwrite the existing key
    new_config = config.dict()
    current_config = config_service.config
    
    for key, value in new_config.items():
        if value and "*" in value:
            new_config[key] = current_config.get(key, "")
            
    success = config_service.save_config(new_config)
    
    # Re-initialize services that depend on config
    global agent_service, embedding_service, rag_service
    agent_service = AgentService()
    embedding_service = EmbeddingService()
    rag_service = RAGService(ai_client=agent_service.ai_client)
    
    return {"status": "success" if success else "error"}

# User Profile APIs
@app.get("/api/user/profile", response_model=UserProfile)
def get_user_profile():
    """Get the current user's personal memory/profile"""
    return memory_service.get_user_profile()

@app.post("/api/user/profile")
def save_user_profile(profile: UserProfile):
    """Save/Update the user's personal memory/profile"""
    memory_service.save_user_profile(profile)
    return {"status": "success"}

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
        
        # Use the title from info (which now has better extraction)
        title = info.get("title", "").strip()
        
        # Fallback to filename only if title is still very generic or empty
        if not title or title.lower() in ["untitled", "untitled pdf", "document"]:
            title = os.path.splitext(file.filename)[0]

        # Initialize meta
        meta = DocMeta(
            doc_id=doc_id,
            title=title,
            num_pages=info["num_pages"],
            created_at=datetime.now().isoformat(),
            notes=[],
            chat_history=[],
            embedding_status="not_started",
            is_rag_only=False
        )
        memory_service.save_doc_meta(meta)
        
        return {
            "doc_id": doc_id, 
            "title": title,
            "num_pages": info["num_pages"], 
            "restored": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/doc/{doc_id}")
def get_doc(doc_id: str):
    meta = memory_service.load_doc_meta(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Document not found")
    return meta

@app.delete("/api/doc/{doc_id}")
async def delete_doc(doc_id: str):
    try:
        # 1. Delete embeddings
        embedding_service.delete_embeddings(doc_id)
        
        # 2. Delete metadata
        memory_service.delete_doc_meta(doc_id)
        
        # 3. Delete PDF and update file_map
        doc_service.delete_document(doc_id)
        
        return {"status": "success", "message": f"Document {doc_id} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/api/agent/active-reading", response_model=ActiveReadingResponse)
async def active_reading(req: ActiveReadingRequest):
    cards = await agent_service.generate_active_reading_cards(req.doc_id, req.page)
    return {"cards": cards}

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

@app.put("/api/doc/{doc_id}/notes/{note_id}")
def update_note(doc_id: str, note_id: str, note: NoteCard):
    memory_service.update_note(doc_id, note_id, note)
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

# ============================================
# RAG 和 Embedding 相关 API（新增，独立功能）
# ============================================
import uuid

@app.post("/api/upload-and-embed")
async def upload_and_embed(files: List[UploadFile] = File(...)):
    """
    Upload multiple PDF files and generate embeddings
    """
    try:
        result = await rag_service.process_uploads(files)
        return result
    except Exception as e:
        print(f"Upload API error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rag-query", response_model=RAGQueryResponse)
async def rag_query(request: RAGQueryRequest):
    """
    Query uploaded PDFs using RAG
    """
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
        
    try:
        # Check if there are any embedded documents
        embedded_docs = embedding_service.get_all_embedded_docs()
        if not embedded_docs:
            return RAGQueryResponse(
                id=str(uuid.uuid4()),
                answer="No documents have been embedded yet. Please upload and embed documents first.",
                question=request.question,
                context_chunks=[],
                total_docs_searched=0
            )
            
        result = await rag_service.query(request.question, top_k=5)
        
        return RAGQueryResponse(
            id=str(uuid.uuid4()),
            answer=result["answer"],
            question=request.question,
            context_chunks=result.get("context_chunks", []),
            total_docs_searched=result.get("total_docs_searched", 0),
            debug_prompt=result.get("debug_prompt")
        )
    except Exception as e:
        print(f"RAG Query API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/doc/{doc_id}/embed")
async def embed_document(doc_id: str):
    """
    Trigger embedding for a specific document
    """
    meta = memory_service.load_doc_meta(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if meta.embedding_status == "completed":
        return {"status": "already_completed", "message": "Document already embedded"}
    
    success = await embedding_service.create_embeddings(doc_id)
    if success:
        return {"status": "success", "message": "Embedding completed"}
    else:
        return {"status": "failed", "message": "Embedding failed"}

@app.get("/api/uploaded-files")
def get_uploaded_files():
    """
    获取所有已上传的文件列表
    """
    try:
        import os
        from datetime import datetime
        
        uploaded_files = []
        uploads_dir = "data/uploads"
        
        # 扫描 uploads 目录
        if os.path.exists(uploads_dir):
            for filename in os.listdir(uploads_dir):
                if filename.endswith('.pdf'):
                    doc_id = filename[:-4]  # 移除 .pdf 后缀
                    
                    # 尝试加载元数据
                    meta = memory_service.load_doc_meta(doc_id)
                    if meta:
                        # 使用元数据中的标题，如果为空或太通用则尝试从 doc_id 恢复
                        title = meta.title
                        if not title or not title.strip() or title.lower() in ["untitled", "untitled pdf", "document"]:
                            if "_" in doc_id:
                                title = doc_id.rsplit('_', 1)[0]
                            else:
                                title = doc_id
                        
                        # 检查是否有有效的对话记录（排除系统消息和空消息）
                        def has_valid_chat(history):
                            if not history:
                                return False
                            # 检查是否有用户或助手的消息，且有内容
                            for msg in history:
                                if isinstance(msg, dict):
                                    role = msg.get('role', '')
                                    content = msg.get('content', '')
                                    # 排除系统消息，只计算用户和助手的有效消息
                                    if role in ['user', 'assistant'] and content and content.strip():
                                        return True
                                elif hasattr(msg, 'role') and hasattr(msg, 'content'):
                                    if msg.role in ['user', 'assistant'] and msg.content and msg.content.strip():
                                        return True
                            return False
                        
                        # 检查是否有有效的笔记（排除空笔记）
                        def has_valid_notes(notes):
                            if not notes:
                                return False
                            # 检查是否有有效的笔记内容
                            for note in notes:
                                if isinstance(note, dict):
                                    if note.get('content') or note.get('title'):
                                        return True
                                elif hasattr(note, 'content') or hasattr(note, 'title'):
                                    return True
                            return False
                        
                        uploaded_files.append({
                            "doc_id": doc_id,
                            "title": title,
                            "num_pages": meta.num_pages,
                            "created_at": meta.created_at,
                            "has_notes": has_valid_notes(meta.notes),
                            "has_chat": has_valid_chat(meta.chat_history),
                            "embedding_status": getattr(meta, "embedding_status", "not_started"),
                            "is_rag_only": getattr(meta, "is_rag_only", False)
                        })
                    else:
                        # 如果没有元数据，从文件获取基本信息
                        try:
                            info = doc_service.get_doc_info(doc_id)
                            if info:
                                # 获取标题，如果为空或无效则使用文件名或 doc_id
                                title = info.get("title", "").strip()
                                if not title or title == "Untitled PDF":
                                    # 尝试从文件名提取（如果有原始文件名信息）
                                    title = f"Document {doc_id[:8]}"
                                
                                file_path = os.path.join(uploads_dir, filename)
                                file_stat = os.stat(file_path)
                                
                                uploaded_files.append({
                                    "doc_id": doc_id,
                                    "title": title,
                                    "num_pages": info.get("num_pages", 0),
                                    "created_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                                    "has_notes": False,
                                    "has_chat": False
                                })
                            else:
                                # 如果无法获取信息，至少显示 doc_id
                                file_path = os.path.join(uploads_dir, filename)
                                if os.path.exists(file_path):
                                    file_stat = os.stat(file_path)
                                    uploaded_files.append({
                                        "doc_id": doc_id,
                                        "title": f"Document {doc_id[:8]}",
                                        "num_pages": 0,
                                        "created_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                                        "has_notes": False,
                                        "has_chat": False
                                    })
                        except Exception as e:
                            print(f"获取文件 {doc_id} 信息时出错: {e}")
                            # 即使出错，也添加一个基本条目
                            file_path = os.path.join(uploads_dir, filename)
                            if os.path.exists(file_path):
                                file_stat = os.stat(file_path)
                                uploaded_files.append({
                                    "doc_id": doc_id,
                                    "title": f"Document {doc_id[:8]}",
                                    "num_pages": 0,
                                    "created_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                                    "has_notes": False,
                                    "has_chat": False
                                })
        
        # 按创建时间倒序排列
        uploaded_files.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {
            "files": uploaded_files,
            "total": len(uploaded_files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New Advanced Reading Features
@app.get("/api/docs/{doc_id}/toc")
async def get_doc_toc(doc_id: str):
    meta = memory_service.load_doc_meta(doc_id)
    if meta and meta.toc:
        return meta.toc
    
    toc = doc_service.get_toc(doc_id)
    if meta:
        meta.toc = toc
        memory_service.save_doc_meta(meta)
    return toc

@app.get("/api/docs/{doc_id}/figures")
async def get_doc_figures(doc_id: str):
    meta = memory_service.load_doc_meta(doc_id)
    if meta and meta.figures:
        return meta.figures
    
    figures = doc_service.extract_figures(doc_id)
    if meta:
        meta.figures = figures
        memory_service.save_doc_meta(meta)
    return figures

@app.post("/api/docs/resolve-reference")
async def resolve_reference(req: ResolveReferenceRequest):
    result = doc_service.resolve_reference(req.doc_id, req.ref_text)
    if not result:
        raise HTTPException(status_code=404, detail="Reference not found")
    return result

@app.post("/api/agent/skim")
async def skim_paper(req: SkimRequest):
    return await agent_service.skim_paper(req.doc_id)

@app.post("/api/agent/analyze-figure")
async def analyze_figure(req: AnalyzeFigureRequest):
    return await agent_service.analyze_figure(req.doc_id, req.figure_data)
