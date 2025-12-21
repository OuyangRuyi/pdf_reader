import fitz  # pymupdf
import pymupdf4llm
import os
import uuid
import shutil
import hashlib
import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

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
        # Save to a temporary file first to extract title
        temp_id = str(uuid.uuid4())
        temp_path = os.path.join(UPLOAD_DIR, f"temp_{temp_id}.pdf")
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Extract title from PDF metadata
        try:
            doc = fitz.open(temp_path)
            title = doc.metadata.get("title", "").strip()
            
            # If title is empty or generic, try to get it from the first page
            if not title or title.lower() in ["untitled", "untitled pdf", "microsoft word - document1", "document1"]:
                # Try to get the first line of text from the first page
                if len(doc) > 0:
                    first_page_text = doc[0].get_text("blocks")
                    if first_page_text:
                        # Sort blocks by vertical position, then horizontal
                        first_page_text.sort(key=lambda b: (b[1], b[0]))
                        # Take the first block that looks like a title (usually the first one)
                        for block in first_page_text:
                            text = block[4].strip()
                            if text and len(text) > 5:
                                # Clean up the text (remove newlines, extra spaces)
                                title = " ".join(text.splitlines()).strip()
                                # Limit length
                                if len(title) > 200:
                                    title = title[:200] + "..."
                                break
            
            doc.close()
        except Exception as e:
            print(f"Error reading PDF metadata or content: {e}")
            title = ""
            
        if not title:
            # Use original filename without extension
            title = os.path.splitext(file.filename)[0]
            
        # Sanitize title for filename
        safe_title = re.sub(r'[\\/*?:"<>|]', "_", title)
        safe_title = safe_title.strip() or "document"
        safe_title = safe_title[:100].strip(". ")
        
        # Create unique doc_id using title and a bit of hash
        doc_id = f"{safe_title}_{file_hash[:6]}"
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        
        # Rename temp file to final path
        if os.path.exists(file_path):
            # If it exists, use a longer hash
            doc_id = f"{safe_title}_{file_hash[:10]}"
            file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
            
        os.rename(temp_path, file_path)
            
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
        title = doc.metadata.get("title", "").strip()
        if not title:
            # Fallback to doc_id (which contains the title or original filename)
            # Remove the hash suffix (last 7 chars: _ + 6 hex)
            if "_" in doc_id:
                title = doc_id.rsplit('_', 1)[0]
            else:
                title = doc_id
                
        return {
            "doc_id": doc_id,
            "file_path": file_path,
            "num_pages": len(doc),
            "title": title
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
            
        # Use pymupdf4llm for high-quality Markdown extraction
        # This handles multi-column layouts, tables, and headers much better
        try:
            md_text = pymupdf4llm.to_markdown(file_path, pages=list(range(max_pages)))
            return md_text
        except Exception as e:
            print(f"Error using pymupdf4llm: {e}, falling back to basic extraction")
            doc = fitz.open(file_path)
            text = ""
            pages_to_read = min(len(doc), max_pages)
            for i in range(pages_to_read):
                text += f"--- Page {i+1} ---\n"
                text += doc[i].get_text() + "\n"
            return text

    def get_structured_layout(self, doc_id: str, max_pages: int = 1000) -> List[Dict[str, Any]]:
        """
        Extract structured layout information using pymupdf4llm for better semantic chunking.
        """
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        if not os.path.exists(file_path):
            raise FileNotFoundError("Document not found")
            
        try:
            # Get actual number of pages to avoid out of range error
            doc = fitz.open(file_path)
            num_pages = len(doc)
            doc.close()
            
            # pymupdf4llm.to_markdown can return a list of dicts if we use the right parameters
            # but for simplicity and reliability, we'll use its internal logic to get clean text
            # and then chunk it by headers/paragraphs.
            pages_to_read = list(range(min(max_pages, num_pages)))
            md_text = pymupdf4llm.to_markdown(file_path, pages=pages_to_read)
            
            # Split by double newlines to get paragraphs/blocks
            raw_blocks = md_text.split("\n\n")
            structured_blocks = []
            
            for i, block in enumerate(raw_blocks):
                if not block.strip(): continue
                
                # Try to estimate page number (pymupdf4llm often inserts page markers like <page: 1>)
                # This is a bit hacky but works for many versions of pymupdf4llm
                page_num = 1
                import re
                page_match = re.search(r"<!-- page_number: (\d+) -->", block)
                if page_match:
                    page_num = int(page_match.group(1))
                
                structured_blocks.append({
                    "page": page_num,
                    "text": block.strip(),
                    "order": i,
                    "bbox": [0, 0, 0, 0] # Markdown blocks don't have bbox easily
                })
            
            if structured_blocks:
                return structured_blocks
        except Exception as e:
            print(f"Error in structured layout with pymupdf4llm: {e}")

        # Fallback to basic block extraction
        doc = fitz.open(file_path)
        all_blocks = []
        pages_to_read = min(len(doc), max_pages)
        for page_idx in range(pages_to_read):
            page = doc[page_idx]
            page_dict = page.get_text("dict")
            for block in page_dict.get("blocks", []):
                if block.get("type") != 0: continue
                
                # Keep spans for classification in EmbeddingService
                lines = block.get("lines", [])
                spans = []
                block_text = ""
                for line in lines:
                    for span in line.get("spans", []):
                        spans.append(span)
                        block_text += span.get("text", "") + " "
                
                if block_text.strip():
                    all_blocks.append({
                        "page": page_idx + 1,
                        "text": block_text.strip(),
                        "order": len(all_blocks),
                        "spans": spans,
                        "bbox": block.get("bbox")
                    })
        return all_blocks

    def get_toc(self, doc_id: str) -> List[Dict[str, Any]]:
        """Get Table of Contents"""
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        if not os.path.exists(file_path):
            return []
        doc = fitz.open(file_path)
        toc = doc.get_toc()
        return [{"level": item[0], "title": item[1], "page": item[2]} for item in toc]

    def extract_figures(self, doc_id: str) -> List[Dict[str, Any]]:
        """
        Improved figure extraction:
        1. Find captions (text starting with Figure/Fig.)
        2. Find the most likely graphical area (raster or vector) associated with the caption
        3. Render that specific area to a PNG (handles vector graphics)
        """
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        if not os.path.exists(file_path):
            return []
        
        doc = fitz.open(file_path)
        figures = []
        
        images_dir = os.path.join("data/uploads", "images", doc_id)
        os.makedirs(images_dir, exist_ok=True)
        
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            
            # 1. Get all text blocks to find captions
            blocks = page.get_text("dict")["blocks"]
            
            # 2. Get all raster images on page
            image_info = page.get_image_info(hashes=True)
            
            # 3. Get all vector drawings (paths)
            # This helps identify areas that are "graphical" but not raster images
            drawings = page.get_drawings()
            
            for b in blocks:
                if b["type"] == 0:  # text
                    text = "".join([span["text"] for line in b["lines"] for span in line["spans"]]).strip()
                    
                    # Look for caption pattern
                    if re.match(r"^(Figure|Fig\.)\s*\d+", text, re.IGNORECASE):
                        caption_bbox = fitz.Rect(b["bbox"])
                        
                        # Find the best graphical area for this caption
                        # Usually figures are ABOVE the caption in papers
                        # We look for images or drawing clusters in a search area above the caption
                        search_area = fitz.Rect(0, max(0, caption_bbox.y0 - 400), page.rect.width, caption_bbox.y0)
                        
                        # Check raster images in search area
                        best_img_bbox = None
                        for img in image_info:
                            img_bbox = fitz.Rect(img["bbox"])
                            if img_bbox.intersects(search_area) and img_bbox.height > 50:
                                if best_img_bbox is None or img_bbox.y1 > best_img_bbox.y1:
                                    best_img_bbox = img_bbox
                        
                        # If no raster image, check vector drawings
                        if not best_img_bbox:
                            # Group drawings that are close to each other
                            relevant_drawings = [d["rect"] for d in drawings if d["rect"].intersects(search_area)]
                            if relevant_drawings:
                                union_rect = relevant_drawings[0]
                                for r in relevant_drawings[1:]:
                                    union_rect |= r
                                if union_rect.height > 50:
                                    best_img_bbox = union_rect

                        if best_img_bbox:
                            # Add some padding
                            render_bbox = best_img_bbox + (-10, -10, 10, 10)
                            # Clip to page
                            render_bbox &= page.rect
                            
                            # Generate unique ID based on caption
                            fig_id = hashlib.md5(text.encode()).hexdigest()[:10]
                            image_filename = f"fig_{page_idx+1}_{fig_id}.png"
                            image_path = os.path.join(images_dir, image_filename)
                            
                            if not os.path.exists(image_path):
                                try:
                                    # Render the area at high resolution (2x)
                                    mat = fitz.Matrix(2, 2)
                                    pix = page.get_pixmap(matrix=mat, clip=render_bbox)
                                    pix.save(image_path)
                                    pix = None
                                except Exception as e:
                                    print(f"Failed to render figure: {e}")
                                    continue
                            
                            image_url = f"/uploads/images/{doc_id}/{image_filename}"
                            
                            figures.append({
                                "id": fig_id,
                                "page": page_idx + 1,
                                "bbox": [render_bbox.x0, render_bbox.y0, render_bbox.x1, render_bbox.y1],
                                "caption": text,
                                "imageUrl": image_url
                            })
        
        # Deduplicate
        unique_figures = []
        seen_captions = set()
        for f in figures:
            if f["caption"] not in seen_captions:
                unique_figures.append(f)
                seen_captions.add(f["caption"])
                
        return unique_figures

    def resolve_reference(self, doc_id: str, ref_text: str) -> Optional[Dict[str, Any]]:
        """Resolve a reference like 'Fig. 1' or 'Section 2' to a page and bbox"""
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        if not os.path.exists(file_path):
            return None
            
        doc = fitz.open(file_path)
        
        # 1. Try exact search first
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            areas = page.search_for(ref_text)
            if areas:
                return {
                    "page": page_idx + 1,
                    "bbox": [areas[0].x0, areas[0].y0, areas[0].x1, areas[0].y1]
                }
        
        # 2. Try normalized search (remove extra spaces, case insensitive)
        normalized_ref = re.sub(r'\s+', ' ', ref_text).strip()
        # Also try without the dot if it's "Fig."
        alt_ref = normalized_ref.replace("Fig.", "Figure") if "Fig." in normalized_ref else normalized_ref.replace("Figure", "Fig.")
        
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            # Search for normalized versions
            for search_term in [normalized_ref, alt_ref]:
                areas = page.search_for(search_term)
                if areas:
                    return {
                        "page": page_idx + 1,
                        "bbox": [areas[0].x0, areas[0].y0, areas[0].x1, areas[0].y1]
                    }
                    
        # 3. If it's a Figure/Table, try to find the caption specifically
        if re.match(r'^(Fig|Figure|Table)\s*\d+', ref_text, re.I):
            # Extract the number
            num_match = re.search(r'\d+', ref_text)
            if num_match:
                num = num_match.group()
                pattern = f"Figure {num}" if "Figure" in ref_text or "Fig" in ref_text else f"Table {num}"
                # Also try "Fig. {num}"
                patterns = [pattern, f"Fig. {num}", f"Fig {num}"]
                
                for page_idx in range(len(doc)):
                    page = doc[page_idx]
                    for p in patterns:
                        areas = page.search_for(p)
                        if areas:
                            return {
                                "page": page_idx + 1,
                                "bbox": [areas[0].x0, areas[0].y0, areas[0].x1, areas[0].y1]
                            }
        
        return None

    def delete_document(self, doc_id: str):
        """Delete PDF file and remove from file_map"""
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
        if os.path.exists(file_path):
            os.remove(file_path)
            
        # Update file_map
        if os.path.exists(FILE_MAP_PATH):
            with open(FILE_MAP_PATH, "r") as f:
                file_map = json.load(f)
            
            # Find and remove the hash entry pointing to this doc_id
            new_file_map = {k: v for k, v in file_map.items() if v != doc_id}
            
            with open(FILE_MAP_PATH, "w") as f:
                json.dump(new_file_map, f, indent=2)
