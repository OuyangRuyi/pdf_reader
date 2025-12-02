import fitz  # pymupdf
import os
import uuid
import shutil
from datetime import datetime

UPLOAD_DIR = "data/uploads"
DOCS_DIR = "data/docs"

class DocumentService:
    def __init__(self):
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        os.makedirs(DOCS_DIR, exist_ok=True)

    def save_upload(self, file) -> str:
        doc_id = str(uuid.uuid4())
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return doc_id

    def get_doc_info(self, doc_id: str):
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        if not os.path.exists(file_path):
            return None
            
        doc = fitz.open(file_path)
        return {
            "doc_id": doc_id,
            "file_path": file_path,
            "num_pages": len(doc),
            "title": doc.metadata.get("title", "Untitled PDF")
        }

    def extract_page_text(self, doc_id: str, page_num: int) -> str:
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        if not os.path.exists(file_path):
            raise FileNotFoundError("Document not found")
            
        doc = fitz.open(file_path)
        # page_num is 1-based from frontend, fitz is 0-based
        if page_num < 1 or page_num > len(doc):
            raise ValueError("Page number out of range")
            
        page = doc[page_num - 1]
        return page.get_text()

    def extract_full_text(self, doc_id: str, max_pages: int = 10) -> str:
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        if not os.path.exists(file_path):
            raise FileNotFoundError("Document not found")
            
        doc = fitz.open(file_path)
        text = ""
        # Limit to first N pages to avoid token limits
        pages_to_read = min(len(doc), max_pages)
        
        for i in range(pages_to_read):
            text += f"--- Page {i+1} ---\n"
            text += doc[i].get_text() + "\n"
            
        return text
