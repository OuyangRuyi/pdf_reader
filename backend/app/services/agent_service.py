import uuid
from datetime import datetime
from typing import List
from .gemini_client import GeminiClient
from .document_service import DocumentService
from ..models.schemas import NoteCard

class AgentService:
    def __init__(self):
        self.gemini = GeminiClient()
        self.doc_service = DocumentService()

    async def run_task(self, doc_id: str, page: int, task_type: str) -> List[NoteCard]:
        print(f"Running task {task_type} for doc {doc_id} page {page}")
        # 1. Perception: Extract text
        try:
            text = self.doc_service.extract_page_text(doc_id, page)
            print(f"Extracted text length: {len(text)}")
        except Exception as e:
            print(f"Error extracting text: {e}")
            return [self._create_error_card(str(e), page)]

        # 2. Planning & Action Dispatch
        # In a full agent, this would be dynamic. For now, we map task_type to actions.
        
        if task_type == "summarize_page":
            # Action: Summarize
            card = await self.action_summarize(text, page=page)
            return [card]

        elif task_type == "draw_diagram_page":
            # Action: Draw
            # For the explicit "Draw Diagram" button, we treat the instruction as "Explain this page visually"
            instruction = "Create a clear technical diagram explaining the key concepts on this page."
            card = await self.action_draw(text, instruction, page)
            return [card]
        
        return []
    async def init_notes(self, doc_id: str) -> List[NoteCard]:
        print(f"Generating init notes for {doc_id}")
        try:
            # Extract text from first 10 pages
            text = self.doc_service.extract_full_text(doc_id, max_pages=10)
            
            # Run summary and image generation in parallel
            summary_task = self.gemini.summarize_document(text)
            image_prompt = f"Create a creative cover image or concept art for a research paper with the following content: {text[:500]}"
            image_task = self.gemini.generate_image(image_prompt)
            
            # Wait for both
            import asyncio
            summary, image_url = await asyncio.gather(summary_task, image_task)
            
            card = NoteCard(
                id=str(uuid.uuid4()),
                type="overview",
                title="Document Overview",
                content=summary,
                imageUrl=image_url,
                page=None,
                createdAt=datetime.now().isoformat()
            )
            return [card]
        except Exception as e:
            print(f"Error in init_notes: {e}")
            return [self._create_error_card(f"Failed to generate overview: {str(e)}", 0)]

    async def action_summarize(self, text: str, instruction: str = None, history: List[dict] = None, page: int = None) -> NoteCard:
        """
        Action: Summarize or Explain text content.
        """
        if instruction:
            # If there is a specific instruction (e.g. "Explain this formula"), treat as chat
            answer = await self.gemini.chat(history or [], text, instruction)
            title = "Explanation"
        else:
            # Default summary
            answer = await self.gemini.summarize_page(text)
            title = f"Summary of Page {page}"

        return NoteCard(
            id=str(uuid.uuid4()),
            type="summary",
            title=title,
            content=answer,
            page=page,
            createdAt=datetime.now().isoformat()
        )

    async def action_draw(self, text: str, instruction: str, page: int) -> NoteCard:
        """
        Action: Generate an image/diagram based on text.
        """
        # 1. Generate Image Prompt using Gemini (Planning/Reasoning step)
        # We ask Gemini to describe the visualization first
        planning_prompt = f"""
        User wants a visualization for the following text with instruction: "{instruction}".
        Please write a detailed prompt for an image generation model to create this visualization.
        Keep it descriptive and visual.
        
        Text context:
        {text[:1000]}
        """
        try:
            # Use the existing model to generate the prompt
            prompt_response = await self.gemini.model.generate_content_async(planning_prompt)
            image_prompt = prompt_response.text
            print(f"Generated image prompt: {image_prompt[:100]}...")
        except Exception as e:
            print(f"Error generating image prompt: {e}")
            image_prompt = f"A technical diagram explaining: {instruction}"

        # 2. Call Image Generation Action
        image_url = await self.gemini.generate_image(image_prompt)
        
        content = f"Generated visualization for: {instruction}"
        if not image_url:
            content = "Failed to generate image."

        return NoteCard(
            id=str(uuid.uuid4()),
            type="image",
            title="Generated Visualization",
            content=content,
            imageUrl=image_url,
            page=page,
            createdAt=datetime.now().isoformat()
        )

    async def chat(self, doc_id: str, page: int, question: str, history: List[dict]) -> NoteCard:
        try:
            # 1. Perception
            text = self.doc_service.extract_page_text(doc_id, page)
            
            # 2. Planning (LLM-based Intent Recognition)
            # We ask Gemini to decide the intent based on the user's request
            plan_prompt = f"""
            Analyze the user's request regarding a document.
            User Request: "{question}"
            
            Determine if the user wants:
            1. Only a text explanation/summary (TEXT)
            2. Only a visual diagram/image (IMAGE)
            3. Both a text explanation and a visual diagram (BOTH)
            
            Reply with ONLY one word: TEXT, IMAGE, or BOTH.
            """
            try:
                plan = await self.gemini.generate_text(plan_prompt)
                intent = plan.strip().upper()
                # Cleanup response if it contains extra text
                if "BOTH" in intent: intent = "BOTH"
                elif "IMAGE" in intent or "DRAW" in intent: intent = "IMAGE"
                else: intent = "TEXT"
            except Exception:
                # Fallback heuristic
                intent = "TEXT"
                if any(kw in question.lower() for kw in ["draw", "image", "diagram"]):
                    intent = "IMAGE"
            
            print(f"User intent identified as: {intent}")

            # 3. Action Execution
            if intent == "BOTH":
                # Execute both actions and combine result
                # A. Text Explanation
                text_answer = await self.gemini.chat(history or [], text, question)
                
                # B. Image Generation
                # Plan the image prompt
                img_plan_prompt = f"""
                User wants a visualization for: "{question}".
                Context: {text[:1000]}
                Write a detailed image generation prompt for a technical diagram or illustration.
                """
                img_prompt = await self.gemini.generate_text(img_plan_prompt)
                image_url = await self.gemini.generate_image(img_prompt)
                
                return NoteCard(
                    id=str(uuid.uuid4()),
                    type="chat_response",
                    title="Explanation & Visualization",
                    content=text_answer,
                    imageUrl=image_url,
                    page=page,
                    createdAt=datetime.now().isoformat()
                )

            elif intent == "IMAGE":
                return await self.action_draw(text, question, page)
            else:
                return await self.action_summarize(text, instruction=question, history=history, page=page)

        except Exception as e:
            return self._create_error_card(str(e), page)

    def _create_error_card(self, error_msg: str, page: int) -> NoteCard:
        return NoteCard(
            id=str(uuid.uuid4()),
            type="error",
            title="Error",
            content=error_msg,
            page=page,
            createdAt=datetime.now().isoformat()
        )
