import fitz  # pymupdf
import os
import uuid
import shutil
import hashlib
import json
from datetime import datetime

UPLOAD_DIR = "data/uploads"
DOCS_DIR = "data/docs"
FILE_MAP_PATH = "data/file_map.json"

class DocumentService:
    def __init__(self):
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        os.makedirs(DOCS_DIR, exist_ok=True)
        if not os.path.exists(FILE_MAP_PATH):
            with open(FILE_MAP_PATH, "w") as f:
                json.dump({}, f)

    def _calculate_file_hash(self, file_obj) -> str:
        md5_hash = hashlib.md5()
        for byte_block in iter(lambda: file_obj.read(4096), b""):
            md5_hash.update(byte_block)
        file_obj.seek(0)  # Reset file pointer
        return md5_hash.hexdigest()

    def save_upload(self, file) -> str:
        # Calculate hash
        file_hash = self._calculate_file_hash(file.file)
        
        # Check if exists in map
        with open(FILE_MAP_PATH, "r") as f:
            file_map = json.load(f)
            
        if file_hash in file_map:
            doc_id = file_map[file_hash]
            file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
            if os.path.exists(file_path):
                return doc_id
        
        # If not exists, save new
        doc_id = str(uuid.uuid4())
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Update map
        file_map[file_hash] = doc_id
        with open(FILE_MAP_PATH, "w") as f:
            json.dump(file_map, f)
            
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
