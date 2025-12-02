import json
import os
from typing import List, Optional
from ..models.schemas import NoteCard, DocMeta

DOCS_DIR = "data/docs"

class MemoryService:
    def __init__(self):
        os.makedirs(DOCS_DIR, exist_ok=True)

    def _get_meta_path(self, doc_id: str) -> str:
        return os.path.join(DOCS_DIR, f"{doc_id}.json")

    def save_doc_meta(self, meta: DocMeta):
        path = self._get_meta_path(meta.doc_id)
        with open(path, "w") as f:
            f.write(meta.model_dump_json(indent=2))

    def load_doc_meta(self, doc_id: str) -> Optional[DocMeta]:
        path = self._get_meta_path(doc_id)
        if not os.path.exists(path):
            return None
        
        with open(path, "r") as f:
            data = json.load(f)
            return DocMeta(**data)

    def add_note(self, doc_id: str, note: NoteCard):
        meta = self.load_doc_meta(doc_id)
        if meta:
            meta.notes.append(note)
            self.save_doc_meta(meta)

    def remove_note(self, doc_id: str, note_id: str):
        meta = self.load_doc_meta(doc_id)
        if meta:
            meta.notes = [n for n in meta.notes if n.id != note_id]
            self.save_doc_meta(meta)
