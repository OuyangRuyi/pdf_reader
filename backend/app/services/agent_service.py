import uuid
from datetime import datetime
from typing import List, Dict, Any
from .multi_model_client import MultiModelClient
from .document_service import DocumentService
from .memory_service import MemoryService
from .config_service import ConfigService
from ..models.schemas import NoteCard, UserProfile

class AgentService:
    def __init__(self):
        self.ai_client = MultiModelClient()
        self.doc_service = DocumentService()
        self.memory_service = MemoryService()
        self.config_service = ConfigService()
    
    def _get_lang_instruction(self) -> str:
        lang = self.config_service.get("LANGUAGE", "en")
        if lang == "zh":
            return "\nIMPORTANT: Please provide all your output and analysis in Chinese (中文).\n"
        return "\nPlease provide all your output and analysis in English.\n"
    
    def get_available_models(self) -> Dict[str, Dict[str, Any]]:
        """Get all available AI models"""
        return self.ai_client.get_available_models()
    
    def set_current_model(self, model_id: str) -> bool:
        """Switch to a different model"""
        return self.ai_client.set_current_model(model_id)
    
    def get_current_model_info(self) -> Dict[str, Any]:
        """Get current model information"""
        return self.ai_client.get_current_model_info()

    async def update_user_profile_from_chat(self, question: str):
        """
        Analyze user question to update their personal memory/profile.
        """
        try:
            profile = self.memory_service.get_user_profile()
            
            # Use LLM to extract interests/topics from the question
            prompt = f"""
            Analyze the following user question about a research paper and extract the core topics or types of information the user is interested in (e.g., "Methodology", "Mathematical Proofs", "Experimental Setup", "Comparative Analysis", etc.).
            
            User Question: "{question}"
            
            Current Interests: {", ".join(profile.interests)}
            
            Return a comma-separated list of 1-3 key interests found in this question. If no new interests are found, return "NONE".
            """
            
            response = await self.ai_client.generate_text(prompt)
            new_interests = [i.strip() for i in response.split(",") if i.strip() != "NONE"]
            
            if new_interests:
                # Add new interests and keep unique
                updated_interests = list(set(profile.interests + new_interests))
                # Limit to top 10 interests to keep it focused
                profile.interests = updated_interests[-10:]
                self.memory_service.save_user_profile(profile)
                print(f"Updated user profile interests: {profile.interests}")
        except Exception as e:
            print(f"Error updating user profile: {e}")

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
                
                # Get user profile for personalization
                profile = self.memory_service.get_user_profile()
                personalization = ""
                if profile.interests or profile.focus_areas or profile.custom_instructions:
                    personalization = "\n\n**Personalization Instructions (User's Core Interests):**\n"
                    if profile.interests:
                        personalization += f"- The user has shown repeated interest in: {', '.join(profile.interests)}\n"
                    if profile.focus_areas:
                        personalization += f"- Prioritize these areas: {', '.join(profile.focus_areas)}\n"
                    if profile.custom_instructions:
                        personalization += f"- User's specific preference: {profile.custom_instructions}\n"
                    personalization += "\nPlease ensure the summary highlights these aspects with higher density and clarity while maintaining a comprehensive overview."

                summary_prompt = f"""
                You are an expert academic researcher. 
                Please provide a comprehensive structured summary of the following research paper text.
                {personalization}
                {self._get_lang_instruction()}
                
                Structure your response as:
                1. **Research Problem**: What is the paper trying to solve?
                2. **Methodology**: How did they solve it?
                3. **Key Findings**: What are the main results?
                4. **Conclusion**: What is the significance?
                
                Text:
                {text}
                """
                summary = await self.ai_client.generate_text(summary_prompt)
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
                    content = "Generated information diagram showing document structure and key concepts." if self.config_service.get("LANGUAGE") == "en" else "已生成展示文档结构和核心概念的信息图表。"
                else:
                    # Generate detailed description
                    print("Generating text description...")
                    lang_instr = self._get_lang_instruction()
                    content = await self.ai_client.generate_text(f"Create a detailed textual description of an information diagram for this document:\n\n{diagram_prompt}" + lang_instr)
                    print(f"Text description generated, length: {len(content)}")
                    image_url = None
                
                print(f"Creating diagram card with imageUrl: {image_url}")
                title = "Document Info Diagram" if self.config_service.get("LANGUAGE") == "en" else "文档信息图表"
                diagram_card = NoteCard(
                    id=str(uuid.uuid4()),
                    type="diagram",
                    title=title,
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
        lang_instr = self._get_lang_instruction()
        if instruction:
            # If there is a specific instruction (e.g. "Explain this formula"), treat as chat
            answer = await self.ai_client.explain_content(text, instruction + lang_instr)
            title = "Explanation" if self.config_service.get("LANGUAGE") == "en" else "解析"
        else:
            # Default summary
            answer = await self.ai_client.summarize_page(text + lang_instr)
            title = f"Summary of Page {page}" if self.config_service.get("LANGUAGE") == "en" else f"第 {page} 页总结"

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
        lang_instr = self._get_lang_instruction()
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
            content = f"Generated visualization for: {instruction}" if self.config_service.get("LANGUAGE") == "en" else f"已生成可视化图表：{instruction}"
            if not image_url:
                content = ("Failed to generate image, but here's a detailed description of what the diagram should look like:\n\n" if self.config_service.get("LANGUAGE") == "en" else "生成图片失败，但这是该图表的详细描述：\n\n") + image_prompt
        else:
            # 当前模型不支持图像生成，提供详细的图表描述
            image_url = None
            if self.config_service.get("LANGUAGE") == "en":
                content = f"Detailed diagram description for: {instruction}\n\n{image_prompt}\n\n(Note: Current model '{current_model_info.get('name', 'Unknown')}' doesn't support image generation. Switch to Gemini models for actual image creation.)"
            else:
                content = f"图表详细描述：{instruction}\n\n{image_prompt}\n\n（注：当前模型 '{current_model_info.get('name', 'Unknown')}' 不支持图像生成。请切换到 Gemini 模型以创建实际图像。）"

        title = "Generated Visualization" if self.config_service.get("LANGUAGE") == "en" else "生成的可视化图表"
        return NoteCard(
            id=str(uuid.uuid4()),
            type="image",
            title=title,
            content=content,
            imageUrl=image_url,
            page=page,
            createdAt=datetime.now().isoformat()
        )

    async def chat(self, doc_id: str, page: int, question: str, history: List[dict]) -> NoteCard:
        try:
            # Update user profile based on the question
            await self.update_user_profile_from_chat(question)
            
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
            lang_instr = self._get_lang_instruction()
            if intent == "BOTH":
                # Execute both actions and combine result
                # A. Text Explanation
                text_answer = await self.ai_client.explain_content(text, question + lang_instr)
                
                # B. Image Generation
                # Plan the image prompt
                img_plan_prompt = f"""
                User wants a visualization for: "{question}".
                Context: {text[:1000]}
                Write a detailed image generation prompt for a technical diagram or illustration.
                """
                img_prompt = await self.ai_client.generate_text(img_plan_prompt)
                image_url = await self.ai_client.generate_image(img_prompt)
                
                title = "Explanation & Visualization" if self.config_service.get("LANGUAGE") == "en" else "解析与可视化"
                return NoteCard(
                    id=str(uuid.uuid4()),
                    type="chat_response",
                    title=title,
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

    async def generate_active_reading_cards(self, doc_id: str, page: int) -> List[Dict[str, Any]]:
        """
        Generate mentor-style guidance cards for the current page.
        """
        try:
            # 1. Get page text
            text = self.doc_service.extract_page_text(doc_id, page)
            
            # 2. Get user profile for personalization
            profile = self.memory_service.get_user_profile()
            
            # 3. Prepare prompt
            prompt = f"""
            You are a senior research mentor guiding a PhD student through a research paper. 
            Based on the following content from Page {page} of the document, generate 1-3 "Active Reading" guidance cards.
            {self._get_lang_instruction()}
            
            Each card should help the student think critically about the paper's methodology, assumptions, experimental design, or conclusions.
            
            User's Research Interests: {", ".join(profile.interests)}
            User's Focus Areas: {", ".join(profile.focus_areas)}
            
            Page Content:
            {text[:4000]}
            
            Return the result as a JSON list of objects, each with:
            - "question": A sharp, critical question about this page's content.
            - "reason": A brief explanation (1-2 sentences) of why this question is important to consider.
            - "type": One of ["methodology", "experiment", "theory", "impact"].
            
            Example:
            [
              {{
                "question": "How does the author justify the choice of baseline models in Table 1?",
                "reason": "The selection of baselines directly impacts the perceived significance of the proposed method's performance gains.",
                "type": "experiment"
              }}
            ]
            
            Return ONLY the JSON.
            """
            
            response = await self.ai_client.generate_text(prompt)
            
            # Clean response if it contains markdown code blocks
            clean_response = response.strip()
            if "```json" in clean_response:
                clean_response = clean_response.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_response:
                clean_response = clean_response.split("```")[1].split("```")[0].strip()
            
            import json
            import re
            try:
                cards = json.loads(clean_response, strict=False)
            except json.JSONDecodeError:
                # Fallback: try to remove actual control characters (0-31)
                clean_response = re.sub(r'[\x00-\x1F\x7F]', '', clean_response)
                cards = json.loads(clean_response, strict=False)
            return cards
        except Exception as e:
            print(f"Error generating active reading cards: {e}")
            return []

    async def skim_paper(self, doc_id: str) -> Dict[str, Any]:
        """
        Implement the Skim-first workflow: Abstract + Conclusion.
        """
        try:
            # 1. Extract key sections
            # We'll look for Abstract and Conclusion in the first and last few pages
            full_text = self.doc_service.extract_full_text(doc_id, max_pages=20)
            
            # 2. Generate Comprehensive Analysis
            prompt = f"""
            You are an expert research assistant. Based on the following text from a research paper, generate a comprehensive "Paper Analysis".
            {self._get_lang_instruction()}
            
            Text Content (Abstract, Intro, Conclusion snippets):
            {full_text[:8000]}
            
            Return a JSON object with the following fields:
            - "problem": The core problem the paper addresses.
            - "core_idea": The main innovation or approach.
            - "method_skeleton": A brief outline of the methodology.
            - "main_results": The key findings or performance gains.
            - "limitations": Any mentioned limitations or future work.
            - "reading_path": A suggested path for deep reading (e.g., "Focus on Section 3.2 for the proof, then Table 2 for results").
            - "detailed_summary": A 3-4 paragraph comprehensive summary of the entire paper.
            
            Return ONLY the JSON.
            """
            
            response = await self.ai_client.generate_text(prompt)
            
            # Clean response and handle potential JSON parsing issues
            clean_response = response.strip()
            if "```json" in clean_response:
                clean_response = clean_response.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_response:
                clean_response = clean_response.split("```")[1].split("```")[0].strip()
            
            # Remove potential control characters that break JSON parsing
            # This handles the "Invalid control character" error
            import re
            # Replace literal newlines/tabs inside strings if they aren't escaped
            # But a simpler way is often just allowing non-strict parsing
            
            import json
            try:
                skim_pack = json.loads(clean_response, strict=False)
            except json.JSONDecodeError:
                # Fallback: try to remove actual control characters (0-31)
                clean_response = re.sub(r'[\x00-\x1F\x7F]', '', clean_response)
                skim_pack = json.loads(clean_response, strict=False)
            
            return skim_pack
        except Exception as e:
            print(f"Error in skim_paper: {e}")
            return {"error": str(e)}

    async def analyze_figure(self, doc_id: str, figure_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a structured Figure Card for a specific figure.
        """
        try:
            # In a real implementation, we would crop the image and send it to a VLM.
            # For now, we'll use the caption and surrounding text.
            caption = figure_data.get("caption", "")
            page = figure_data.get("page", 1)
            
            # Get context around the figure
            page_text = self.doc_service.extract_page_text(doc_id, page)
            
            prompt = f"""
            Analyze the following figure from a research paper based on its caption and the page context.
            {self._get_lang_instruction()}
            
            Figure Caption: {caption}
            Page Context: {page_text[:2000]}
            
            Provide a clear and concise explanation of what this figure shows and its significance in the paper.
            
            Return a JSON object with:
            - "explanation": A detailed but concise explanation of the figure.
            
            Return ONLY the JSON.
            """
            
            response = await self.ai_client.generate_text(prompt)
            
            # Clean response
            clean_response = response
            if "```json" in response:
                clean_response = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                clean_response = response.split("```")[1].split("```")[0].strip()
            
            import json
            return json.loads(clean_response)
        except Exception as e:
            print(f"Error in analyze_figure: {e}")
            return {"error": str(e)}
