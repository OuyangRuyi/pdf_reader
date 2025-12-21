import os
import json
import numpy as np
import re
import traceback
import uuid
from typing import List, Tuple, Dict, Any
from ..services.document_service import DocumentService
from ..services.multi_model_client import MultiModelClient
from ..services.embedding_service import EmbeddingService
from ..services.config_service import ConfigService

class RAGService:
    def __init__(self, ai_client: MultiModelClient = None):
        """
        Initialize RAG Service
        ai_client: Optional MultiModelClient instance
        """
        self.embedding_service = EmbeddingService()
        self.ai_client = ai_client if ai_client is not None else MultiModelClient()
        self.doc_service = DocumentService()
        self.config_service = ConfigService()
        
        current_model = self.ai_client.get_current_model_info()
        print(f"RAG Service initialized with model: {current_model.get('name')} ({current_model.get('model_id')})")
    
    async def query(self, question: str, top_k: int = 5) -> Dict[str, Any]:
        """
        Perform RAG query: Retrieve -> Rank -> Generate
        """
        try:
            print(f"RAG Query: {question}")
            
            # 1. Retrieve relevant chunks
            relevant_results = await self._retrieve_relevant_chunks(question, top_k)
            if not relevant_results:
                return {
                    "answer": "No relevant document content found. Please upload and embed documents first.",
                    "context_chunks": [],
                    "total_docs_searched": 0
                }
            
            # 2. Prepare context for LLM
            context_text, context_chunks = self._prepare_context(relevant_results)
            
            # 3. Generate answer using LLM
            answer = await self._generate_answer(question, context_text)
            
            return {
                "answer": answer,
                "context_chunks": context_chunks,
                "total_docs_searched": len(self.embedding_service.get_all_embedded_docs()),
                "debug_prompt": context_text[:1000]
            }
            
        except Exception as e:
            print(f"Error in RAG query: {e}")
            traceback.print_exc()
            return {
                "answer": f"An error occurred during RAG query: {str(e)}",
                "context_chunks": [],
                "total_docs_searched": 0
            }

    async def _retrieve_relevant_chunks(self, question: str, top_k: int) -> List[Dict[str, Any]]:
        """Retrieve and rank chunks from all embedded documents"""
        question_embedding = await self.embedding_service.get_question_embedding(question)
        if not question_embedding:
            return []
            
        doc_ids = self.embedding_service.get_all_embedded_docs()
        if not doc_ids:
            return []
            
        all_candidates = []
        for doc_id in doc_ids:
            chunks_info, embeddings, full_text = self.embedding_service.load_embeddings(doc_id)
            if not chunks_info or not embeddings:
                continue
                
            # Calculate similarities in batch
            scores = self._calculate_similarities(question_embedding, embeddings)
            
            for i, (chunk, score) in enumerate(zip(chunks_info, scores)):
                all_candidates.append({
                    "doc_id": doc_id,
                    "chunk_info": chunk,
                    "score": score,
                    "full_text": full_text
                })
        
        # Sort by score and take top_k
        all_candidates.sort(key=lambda x: x["score"], reverse=True)
        
        # Deduplicate and filter
        unique_results = []
        seen_texts = set()
        
        for cand in all_candidates:
            if len(unique_results) >= top_k:
                break
                
            text = cand["chunk_info"].get("text", "") if isinstance(cand["chunk_info"], dict) else cand["chunk_info"]
            if text in seen_texts:
                continue
                
            # Check for high overlap with already selected chunks
            is_redundant = False
            for existing in unique_results:
                existing_text = existing["chunk_info"].get("text", "") if isinstance(existing["chunk_info"], dict) else existing["chunk_info"]
                if self._get_overlap_score(text, existing_text) > 0.7:
                    is_redundant = True
                    break
            
            if not is_redundant:
                unique_results.append(cand)
                seen_texts.add(text)
                
        return unique_results

    def _prepare_context(self, results: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
        """Expand chunks and format context for the prompt"""
        context_parts = []
        formatted_chunks = []
        
        for res in results:
            doc_id = res["doc_id"]
            chunk_info = res["chunk_info"]
            score = res["score"]
            full_text = res["full_text"]
            
            # Get metadata
            page = chunk_info.get("page", "Unknown")
            c_type = chunk_info.get("type", "paragraph")
            
            # Expand to full paragraph if possible (only for old format or if needed)
            if "start" in chunk_info and chunk_info["start"] != -1:
                expanded_text = self._expand_to_paragraph(chunk_info, doc_id, full_text)
            else:
                expanded_text = chunk_info.get("text", "")
            
            context_parts.append(f"[Doc {doc_id[:8]}..., Page {page}, Type {c_type}] (Score: {score:.3f})\n{expanded_text}")
            formatted_chunks.append({
                "doc_id": doc_id,
                "page": page,
                "type": c_type,
                "chunk": expanded_text,
                "similarity_score": float(score),
                "bbox": chunk_info.get("bbox")
            })
            
        return "\n\n---\n\n".join(context_parts), formatted_chunks

    async def _generate_answer(self, question: str, context: str) -> str:
        """Call LLM to generate answer based on context"""
        lang = self.config_service.get("LANGUAGE", "en")
        lang_instr = "\nIMPORTANT: Please provide your answer in Chinese (中文).\n" if lang == "zh" else "\nPlease provide your answer in English.\n"
        
        prompt = f"""You are a professional document analysis assistant. 
The user has asked a question, and I have retrieved some potentially relevant snippets from the documents.

**Instructions:**
1. Use the provided "Document Context" as your primary source of information.
2. If the context contains the answer, prioritize it and cite the source (e.g., [Doc ID, Page X]).
3. If the context is insufficient or only partially answers the question, you should use your internal knowledge to provide a more complete and helpful answer. 
4. You MUST clearly distinguish between what is explicitly stated in the documents and what is your general knowledge or inference.
5. If the retrieved context is completely irrelevant, acknowledge that the documents don't seem to cover this topic, and then provide a helpful answer based on your general knowledge.
6. Maintain a professional, objective, and helpful tone.
{lang_instr}

**Document Context:**
{context}

**User Question:** {question}

**Answer:**
"""
        try:
            return await self.ai_client.generate_text(prompt)
        except Exception as e:
            print(f"LLM generation failed: {e}")
            return f"Error generating AI response: {str(e)}"

    def _calculate_similarities(self, query_vec: List[float], doc_vecs: List[List[float]]) -> np.ndarray:
        """Calculate cosine similarities using numpy"""
        q = np.array(query_vec)
        d = np.array(doc_vecs)
        
        # Normalize vectors
        q_norm = np.linalg.norm(q)
        d_norms = np.linalg.norm(d, axis=1)
        
        # Avoid division by zero
        if q_norm == 0: return np.zeros(len(doc_vecs))
        d_norms[d_norms == 0] = 1
        
        return np.dot(d, q) / (q_norm * d_norms)

    def _get_overlap_score(self, s1: str, s2: str) -> float:
        """Simple Jaccard similarity for deduplication"""
        words1 = set(s1.lower().split())
        words2 = set(s2.lower().split())
        if not words1 or not words2: return 0.0
        return len(words1 & words2) / len(words1 | words2)

    def _expand_to_paragraph(self, chunk_info: Any, doc_id: str, full_text: str) -> str:
        """Expand a chunk to its surrounding paragraph for better context"""
        if isinstance(chunk_info, str):
            text = chunk_info
            start, end = -1, -1
        else:
            text = chunk_info.get("text", "")
            start = chunk_info.get("start", -1)
            end = chunk_info.get("end", -1)
            
        if not full_text:
            try:
                full_text = self.doc_service.extract_full_text(doc_id, max_pages=1000)
            except:
                return text
                
        if start < 0 or end < 0:
            start = full_text.find(text)
            if start == -1: return text
            end = start + len(text)
            
        # Look for paragraph boundaries (\n\n) or sentence boundaries
        p_start = full_text.rfind('\n\n', max(0, start - 500), start)
        if p_start == -1:
            p_start = max(0, start - 200) # Fallback
        else:
            p_start += 2
            
        p_end = full_text.find('\n\n', end, min(len(full_text), end + 500))
        if p_end == -1:
            p_end = min(len(full_text), end + 200) # Fallback
            
        paragraph = full_text[p_start:p_end].strip()
        return self._clean_text(paragraph) if paragraph else text

    def _clean_text(self, text: str) -> str:
        """Basic text cleaning"""
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    async def process_uploads(self, files: List[Any]) -> Dict[str, Any]:
        """
        Process multiple PDF uploads: Save metadata only (no automatic embedding)
        """
        try:
            uploaded_docs = []
            failed_files = []
            
            for file in files:
                if not file.filename.lower().endswith('.pdf'):
                    failed_files.append({"name": file.filename, "reason": "Not a PDF file"})
                    continue
                
                try:
                    print(f"Saving upload: {file.filename}")
                    doc_id = self.doc_service.save_upload(file)
                    
                    # Check if meta exists (restored)
                    from ..services.memory_service import MemoryService
                    memory = MemoryService()
                    existing_meta = memory.load_doc_meta(doc_id)
                    
                    if existing_meta:
                        uploaded_docs.append({
                            "doc_id": doc_id,
                            "title": existing_meta.title,
                            "filename": file.filename,
                            "status": "restored",
                            "embedding_status": existing_meta.embedding_status
                        })
                        continue

                    info = self.doc_service.get_doc_info(doc_id)
                    title = info.get("title", "").strip()
                    
                    # Fallback to filename only if title is still very generic or empty
                    if not title or title.lower() in ["untitled", "untitled pdf", "document"]:
                        title = os.path.splitext(file.filename)[0]

                    from ..models.schemas import DocMeta
                    from datetime import datetime
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
                    memory.save_doc_meta(meta)
                    
                    uploaded_docs.append({
                        "doc_id": doc_id,
                        "title": title,
                        "filename": file.filename,
                        "status": "success",
                        "embedding_status": "not_started"
                    })
                except Exception as e:
                    print(f"Error processing {file.filename}: {e}")
                    failed_files.append({"name": file.filename, "reason": str(e)})
            
            return {
                "status": "success",
                "uploaded_docs": uploaded_docs,
                "failed_files": failed_files
            }
        except Exception as e:
            print(f"Upload processing failed: {e}")
            raise e
