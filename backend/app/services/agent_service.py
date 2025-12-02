import uuid
from datetime import datetime
from typing import List, Dict, Any
from .multi_model_client import MultiModelClient
from .document_service import DocumentService
from ..models.schemas import NoteCard

class AgentService:
    def __init__(self):
        self.ai_client = MultiModelClient()
        self.doc_service = DocumentService()
    
    def get_available_models(self) -> Dict[str, Dict[str, Any]]:
        """Get all available AI models"""
        return self.ai_client.get_available_models()
    
    def set_current_model(self, model_id: str) -> bool:
        """Switch to a different model"""
        return self.ai_client.set_current_model(model_id)
    
    def get_current_model_info(self) -> Dict[str, Any]:
        """Get current model information"""
        return self.ai_client.get_current_model_info()

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
    async def init_notes(self, doc_id: str, note_type: str = 'both') -> List[NoteCard]:
        print(f"Generating init notes for {doc_id}, type: {note_type}")
        try:
            # Check if AI client is available
            current_model = self.ai_client.get_current_model_info()
            print(f"Current model: {current_model}")
            
            # Extract text from first 10 pages
            text = self.doc_service.extract_full_text(doc_id, max_pages=10)
            print(f"Extracted text length: {len(text)}")
            cards = []
            
            # Generate summary if requested
            if note_type in ['summary', 'both']:
                print("Generating summary...")
                summary = await self.ai_client.summarize_document(text)
                print(f"Summary generated, length: {len(summary)}")
                summary_card = NoteCard(
                    id=str(uuid.uuid4()),
                    type="overview",
                    title="Document Summary", 
                    content=summary,
                    imageUrl=None,
                    page=None,
                    createdAt=datetime.now().isoformat()
                )
                cards.append(summary_card)
            
            # Generate info diagram if requested
            if note_type in ['diagram', 'both']:
                print("Generating diagram...")
                # Improved prompt for information-dense diagram
                diagram_prompt = f"""Create a comprehensive information diagram that visualizes the key concepts, relationships, and structure of this research document. 

Focus on:
- Main topics and subtopics hierarchy
- Key findings and data points
- Methodologies and processes described
- Important relationships between concepts
- Technical details and specifications mentioned

Document content: {text[:1500]}

Style: Technical infographic, information-dense, clear labels and connections, suitable for academic/research context."""
                
                current_model_info = self.ai_client.get_current_model_info()
                print(f"Model supports image: {current_model_info.get('supports_image', False)}")
                
                if current_model_info.get("supports_image", False):
                    # Generate actual image
                    print("Generating image with AI...")
                    image_url = await self.ai_client.generate_image(diagram_prompt)
                    print(f"Image generated: {image_url}")
                    content = "Generated information diagram showing document structure and key concepts."
                else:
                    # Generate detailed description
                    print("Generating text description...")
                    content = await self.ai_client.generate_text(f"Create a detailed textual description of an information diagram for this document:\n\n{diagram_prompt}")
                    print(f"Text description generated, length: {len(content)}")
                    image_url = None
                
                print(f"Creating diagram card with imageUrl: {image_url}")
                diagram_card = NoteCard(
                    id=str(uuid.uuid4()),
                    type="diagram",
                    title="Document Info Diagram",
                    content=content,
                    imageUrl=image_url,
                    page=None,
                    createdAt=datetime.now().isoformat()
                )
                print(f"Diagram card created: {diagram_card.imageUrl}")
                cards.append(diagram_card)
            
            return cards
        except Exception as e:
            print(f"Error in init_notes: {e}")
            return [self._create_error_card(f"Failed to generate {note_type}: {str(e)}", 0)]

    async def action_summarize(self, text: str, instruction: str = None, history: List[dict] = None, page: int = None) -> NoteCard:
        """
        Action: Summarize or Explain text content.
        """
        if instruction:
            # If there is a specific instruction (e.g. "Explain this formula"), treat as chat
            answer = await self.ai_client.explain_content(text, instruction)
            title = "Explanation"
        else:
            # Default summary
            answer = await self.ai_client.summarize_page(text)
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
            # Use the AI client to generate the prompt
            image_prompt = await self.ai_client.generate_text(planning_prompt)
            print(f"Generated image prompt: {image_prompt[:100]}...")
        except Exception as e:
            print(f"Error generating image prompt: {e}")
            image_prompt = f"A technical diagram explaining: {instruction}"

        # 2. Call Image Generation Action
        current_model_info = self.ai_client.get_current_model_info()
        
        if current_model_info.get("supports_image", False):
            # 当前模型支持图像生成
            image_url = await self.ai_client.generate_image(image_prompt)
            content = f"Generated visualization for: {instruction}"
            if not image_url:
                content = "Failed to generate image, but here's a detailed description of what the diagram should look like:\n\n" + image_prompt
        else:
            # 当前模型不支持图像生成，提供详细的图表描述
            image_url = None
            content = f"Detailed diagram description for: {instruction}\n\n{image_prompt}\n\n(Note: Current model '{current_model_info.get('name', 'Unknown')}' doesn't support image generation. Switch to Gemini models for actual image creation.)"

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
                text_answer = await self.ai_client.explain_content(text, question)
                
                # B. Image Generation
                # Plan the image prompt
                img_plan_prompt = f"""
                User wants a visualization for: "{question}".
                Context: {text[:1000]}
                Write a detailed image generation prompt for a technical diagram or illustration.
                """
                img_prompt = await self.ai_client.generate_text(img_plan_prompt)
                image_url = await self.ai_client.generate_image(img_prompt)
                
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
