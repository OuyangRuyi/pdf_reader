import os
import json
import numpy as np
import asyncio
import uuid
import re
from typing import List, Tuple, Dict, Any
from openai import AsyncOpenAI
from ..services.document_service import DocumentService
from ..services.config_service import ConfigService

# 配置 - 优化参数
EMBEDDING_MODEL = "text-embedding-3-large"
BATCH_SIZE = 100  # 增大批量大小（从50增加到100）
CHUNK_SIZE = 800  # 减小 chunk 大小，提高检索精度
CHUNK_OVERLAP = 150  # chunk 之间的重叠字符数

class EmbeddingService:
    def __init__(self):
        self.doc_service = DocumentService()
        self.config_service = ConfigService()
        self.embeddings_dir = "data/embeddings"
        os.makedirs(self.embeddings_dir, exist_ok=True)
        
        # 初始化异步 OpenAI 客户端
        api_key = self.config_service.get("OPENAI_API_KEY", "")
        base_url = self.config_service.get("OPENAI_BASE_URL", "")
        
        if api_key:
            self.client = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url
            )
        else:
            self.client = None
            print("Warning: OPENAI_API_KEY not set, embedding service will be limited")
    
    async def create_embeddings(self, doc_id: str) -> bool:
        """
        为 PDF 文档创建结构化 embedding（异步版本）
        """
        if not self.client:
            print("Error: OpenAI API Key is missing. Please configure it in the settings.")
            return False
            
        try:
            print(f"开始为文档 {doc_id} 创建结构化 embeddings...")
            
            # 更新状态为处理中
            from ..services.memory_service import MemoryService
            memory = MemoryService()
            memory.update_embedding_status(doc_id, "processing")
            
            # 1. 提取结构化布局信息
            blocks = self.doc_service.get_structured_layout(doc_id)
            if not blocks:
                print(f"文档 {doc_id} 没有可提取的文本块")
                memory.update_embedding_status(doc_id, "failed")
                return False
            
            # 2. 识别标题并构建章节树
            classified_blocks = self._classify_blocks(blocks)
            sections = self._build_section_tree(classified_blocks)
            
            # 3. 创建 Typed Chunks
            typed_chunks = self._create_typed_chunks(classified_blocks, sections)
            print(f"文档 {doc_id} 被分为 {len(typed_chunks)} 个结构化 chunks")
            
            # 4. 异步批量生成 embedding
            # 优化：在 embedding 文本中加入章节上下文，提高检索相关性
            embedding_texts = []
            for c in typed_chunks:
                # 构造增强文本：[章节标题] 内容
                # 这样向量会包含结构化语义，更容易被相关问题匹配
                context_prefix = f"[{c.get('section_title', 'General')}] "
                embedding_texts.append(context_prefix + c["text"])
            
            embeddings = []
            tasks = []
            
            for i in range(0, len(embedding_texts), BATCH_SIZE):
                batch_chunks = embedding_texts[i:i + BATCH_SIZE]
                tasks.append(self._get_embeddings_batch(batch_chunks))
            
            print(f"开始并发处理 {len(tasks)} 个批次...")
            results = await asyncio.gather(*tasks)
            
            for batch_embeddings in results:
                embeddings.extend(batch_embeddings)
            
            # 5. 保存结构化 embeddings
            self._save_structured_embeddings(doc_id, typed_chunks, embeddings, sections)
            
            # 更新状态为已完成
            memory.update_embedding_status(doc_id, "completed")
            
            print(f"文档 {doc_id} 的结构化 embeddings 创建完成")
            return True
        except Exception as e:
            print(f"为文档 {doc_id} 创建 embeddings 时出错: {e}")
            from ..services.memory_service import MemoryService
            MemoryService().update_embedding_status(doc_id, "failed")
            import traceback
            traceback.print_exc()
            return False

    def _classify_blocks(self, blocks: List[Dict]) -> List[Dict]:
        """识别块类型：heading, paragraph, caption, etc."""
        if not blocks: return []
        
        # 计算字体大小统计信息
        sizes = []
        for b in blocks:
            if "spans" in b:
                for s in b["spans"]:
                    sizes.append(s["size"])
        
        # 如果没有字体大小信息（例如来自 pymupdf4llm 的 Markdown），使用文本特征分类
        if not sizes:
            classified = []
            for b in blocks:
                text = b.get("text", "")
                b_type = "paragraph"
                
                # Markdown 标题识别
                if text.startswith("#"):
                    b_type = "heading"
                # 识别 Caption
                elif text.lower().startswith("fig") or text.lower().startswith("table"):
                    b_type = "caption"
                # 识别列表项
                elif text.strip().startswith(("- ", "* ", "1. ")):
                    b_type = "list_item"
                    
                classified.append({**b, "type": b_type, "font_size": 0})
            return classified

        mean_size = np.mean(sizes) if sizes else 10
        std_size = np.std(sizes) if sizes else 2
        heading_threshold = mean_size + 1.5 * std_size
        
        classified = []
        for b in blocks:
            text = b["text"]
            spans = b.get("spans", [])
            max_size = max([s["size"] for s in spans]) if spans else 0
            is_bold = any([s["flags"] & 2 for s in spans]) # PyMuPDF bold flag is 2
            
            # 启发式标题识别
            is_h = False
            # 1. 字体显著大于均值
            if max_size > heading_threshold: is_h = True
            # 2. 加粗且短文本
            elif is_bold and len(text) < 100: is_h = True
            # 3. 匹配章节模式
            elif re.match(r'^(\d+(\.\d+)*)\s+', text) or re.match(r'^(Abstract|Introduction|Related Work|Method|Experiments|Conclusion|Results|Discussion|References)', text, re.I):
                if len(text) < 150: is_h = True
            
            b_type = "heading" if is_h else "paragraph"
            
            # 识别 Caption (通常字体较小且以 Figure/Table 开头)
            if not is_h and (text.lower().startswith("fig") or text.lower().startswith("table")):
                if max_size < mean_size: b_type = "caption"
                
            classified.append({**b, "type": b_type, "font_size": max_size})
            
        return classified

    def _build_section_tree(self, blocks: List[Dict]) -> List[Dict]:
        """构建章节树"""
        sections = []
        current_section = {"id": "root", "title": "Document Start", "level": 0, "start_page": 1}
        
        for b in blocks:
            if b["type"] == "heading":
                # 结束当前章节
                current_section["end_page"] = b["page"]
                sections.append(current_section)
                
                # 开启新章节
                current_section = {
                    "id": str(uuid.uuid4()) if "uuid" not in globals() else "sec_" + str(len(sections)),
                    "title": b["text"],
                    "level": 1, # 简化处理，暂不分级
                    "start_page": b["page"]
                }
        
        current_section["end_page"] = blocks[-1]["page"] if blocks else 1
        sections.append(current_section)
        return sections

    def _create_typed_chunks(self, blocks: List[Dict], sections: List[Dict]) -> List[Dict]:
        """创建 Typed Chunks，并加入上下文信息以提高检索质量"""
        chunks = []
        current_sec_idx = 0
        
        for b in blocks:
            # 更新当前所属章节
            while current_sec_idx < len(sections) - 1 and b["page"] >= sections[current_sec_idx+1]["start_page"]:
                if b["type"] == "heading" and b["text"] == sections[current_sec_idx+1]["title"]:
                    current_sec_idx += 1
                else:
                    # 如果页码已经明显超过当前章节范围，也尝试推进
                    if b["page"] > sections[current_sec_idx].get("end_page", 999):
                        current_sec_idx += 1
                    else:
                        break
            
            section = sections[current_sec_idx]
            section_id = section["id"]
            section_title = section["title"]
            
            # 如果段落太长，进行二次切分
            if len(b["text"]) > CHUNK_SIZE:
                sub_texts = [b["text"][i:i+CHUNK_SIZE] for i in range(0, len(b["text"]), CHUNK_SIZE - CHUNK_OVERLAP)]
                for st in sub_texts:
                    chunks.append({
                        "text": st,
                        "page": b["page"],
                        "bbox": b.get("bbox", [0,0,0,0]),
                        "type": b["type"],
                        "section_id": section_id,
                        "section_title": section_title
                    })
            else:
                chunks.append({
                    "text": b["text"],
                    "page": b["page"],
                    "bbox": b.get("bbox", [0,0,0,0]),
                    "type": b["type"],
                    "section_id": section_id,
                    "section_title": section_title
                })
                
        return chunks

    def _save_structured_embeddings(self, doc_id: str, chunks: List[Dict], embeddings: List[List[float]], sections: List[Dict]):
        """保存结构化 embeddings"""
        embedding_file = os.path.join(self.embeddings_dir, f"{doc_id}.json")
        
        data = {
            "doc_id": doc_id,
            "chunks": chunks,
            "embeddings": embeddings,
            "sections": sections,
            "model": EMBEDDING_MODEL,
            "version": "2.0" # 结构化版本
        }
        
        with open(embedding_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _chunk_text(self, text: str) -> List[Tuple[str, int, int]]:
        """
        将文本分块，保持语义完整性，确保在句子边界切分
        返回: List[Tuple[chunk_text, start_pos, end_pos]]
        """
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = min(start + CHUNK_SIZE, text_length)
            
            # 优先在句子边界断开
            if end < text_length:
                # 向后查找句子边界（优先顺序：段落、句子、短语）
                for separator in ['\n\n', '\n', '. ', '。', '! ', '? ', '; ', ', ', ' ', '']:
                    sep_pos = text.rfind(separator, start, end)
                    if sep_pos != -1 and sep_pos > start:
                        end = sep_pos + len(separator)
                        break
            
            chunk_text = text[start:end].strip()
            
            # 只添加非空的 chunk，且至少包含一些有意义的内容
            if chunk_text and len(chunk_text) > 10:  # 至少 10 个字符
                # 保存chunk文本和其在原文中的位置
                chunks.append((chunk_text, start, end))
            
            # 移动到下一个 chunk，考虑重叠
            start = max(start + 1, end - CHUNK_OVERLAP)
        
        return chunks
    
    async def _get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        异步批量获取 embeddings
        """
        try:
            response = await self.client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            print(f"获取 embeddings 时出错: {e}")
            # 返回空 embeddings
            return [[0.0] * 3072 for _ in texts]  # text-embedding-3-large 的维度是 3072
    
    def _save_embeddings(self, doc_id: str, chunk_data: List[Tuple[str, int, int]], embeddings: List[List[float]], full_text: str = None):
        """
        保存 embeddings 到文件
        chunk_data: List[Tuple[chunk_text, start_pos, end_pos]]
        """
        embedding_file = os.path.join(self.embeddings_dir, f"{doc_id}.json")
        
        # 构建chunks信息（包含位置）
        chunks_info = []
        for chunk_text, start_pos, end_pos in chunk_data:
            chunks_info.append({
                "text": chunk_text,
                "start": start_pos,
                "end": end_pos
            })
        
        data = {
            "doc_id": doc_id,
            "chunks": chunks_info,
            "embeddings": embeddings,
            "model": EMBEDDING_MODEL,
            "full_text_length": len(full_text) if full_text else 0
        }
        
        # 如果full_text不是太大（<10MB），也保存一份用于快速检索
        if full_text and len(full_text) < 10 * 1024 * 1024:  # 10MB
            data["full_text"] = full_text
        
        with open(embedding_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def load_embeddings(self, doc_id: str) -> Tuple[List[dict], List[List[float]], str]:
        """
        加载已保存的 embeddings
        返回: (chunks_info, embeddings, full_text)
        """
        embedding_file = os.path.join(self.embeddings_dir, f"{doc_id}.json")
        if not os.path.exists(embedding_file):
            return [], [], ""
        
        with open(embedding_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
            chunks_info = data.get("chunks", [])
            # 兼容旧格式
            if chunks_info and isinstance(chunks_info[0], str):
                chunks_info = [{"text": chunk, "start": -1, "end": -1, "type": "paragraph"} for chunk in chunks_info]
            elif chunks_info and "text" not in chunks_info[0]:
                # 兼容 V1.5 格式 (Tuple)
                chunks_info = [{"text": c[0], "start": c[1], "end": c[2], "type": "paragraph"} for c in chunks_info]
            
            embeddings = data.get("embeddings", [])
            full_text = data.get("full_text", "")
            
            return chunks_info, embeddings, full_text
    
    async def get_question_embedding(self, question: str) -> List[float]:
        """
        异步获取问题的 embedding
        """
        try:
            response = await self.client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=[question]
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"获取问题 embedding 时出错: {e}")
            return []
    
    def get_all_embedded_docs(self) -> List[str]:
        """
        获取所有已创建 embedding 的文档 ID
        """
        if not os.path.exists(self.embeddings_dir):
            return []
        
        doc_ids = []
        for filename in os.listdir(self.embeddings_dir):
            if filename.endswith('.json'):
                doc_id = filename[:-5]  # 移除 .json 后缀
                doc_ids.append(doc_id)
        
        return doc_ids
    
    def delete_all_embeddings(self) -> int:
        """
        删除所有已保存的 embeddings 文件
        返回删除的文件数量
        """
        if not os.path.exists(self.embeddings_dir):
            return 0
        
        deleted_count = 0
        for filename in os.listdir(self.embeddings_dir):
            if filename.endswith('.json'):
                embedding_file = os.path.join(self.embeddings_dir, filename)
                try:
                    os.remove(embedding_file)
                    deleted_count += 1
                    print(f"已删除 embedding 文件: {filename}")
                except Exception as e:
                    print(f"删除 embedding 文件 {filename} 时出错: {e}")
        
        print(f"共删除 {deleted_count} 个 embedding 文件")
        return deleted_count
    
    def delete_embeddings(self, doc_id: str):
        """Delete embeddings for a specific document"""
        path = os.path.join(self.embeddings_dir, f"{doc_id}.json")
        if os.path.exists(path):
            os.remove(path)
