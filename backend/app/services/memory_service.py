import json
import os
from datetime import datetime
from typing import List, Optional
from ..models.schemas import NoteCard, DocMeta, UserProfile

DOCS_DIR = "data/docs"
USER_PROFILE_PATH = "data/user_profile.json"

class MemoryService:
    def __init__(self):
        os.makedirs(DOCS_DIR, exist_ok=True)
        os.makedirs("data", exist_ok=True)

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

    def delete_doc_meta(self, doc_id: str):
        """Delete document metadata file"""
        path = self._get_meta_path(doc_id)
        if os.path.exists(path):
            os.remove(path)

    def get_user_profile(self) -> UserProfile:
        if not os.path.exists(USER_PROFILE_PATH):
            return UserProfile(
                interests=[],
                focus_areas=["Methodology", "Key Findings"],
                custom_instructions="",
                last_updated=datetime.now().isoformat()
            )
        
        with open(USER_PROFILE_PATH, "r") as f:
            data = json.load(f)
            return UserProfile(**data)

    def save_user_profile(self, profile: UserProfile):
        profile.last_updated = datetime.now().isoformat()
        with open(USER_PROFILE_PATH, "w") as f:
            f.write(profile.model_dump_json(indent=2))

    def update_embedding_status(self, doc_id: str, status: str):
        meta = self.load_doc_meta(doc_id)
        if meta:
            meta.embedding_status = status
            self.save_doc_meta(meta)

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

    def update_note(self, doc_id: str, note_id: str, updated_note: NoteCard):
        meta = self.load_doc_meta(doc_id)
        if meta:
            for i, note in enumerate(meta.notes):
                if note.id == note_id:
                    meta.notes[i] = updated_note
                    break
            self.save_doc_meta(meta)

    def update_chat_history(self, doc_id: str, history: List[dict]):
        meta = self.load_doc_meta(doc_id)
        if meta:
            # Store the full chat history with all message data
            meta.chat_history = history
            self.save_doc_meta(meta)
    
    def delete_chat_message(self, doc_id: str, message_index: int):
        meta = self.load_doc_meta(doc_id)
        if meta and 0 <= message_index < len(meta.chat_history):
            meta.chat_history.pop(message_index)
            self.save_doc_meta(meta)
    
    def clear_chat_history(self, doc_id: str):
        meta = self.load_doc_meta(doc_id)
        if meta:
            meta.chat_history = []
            self.save_doc_meta(meta)
