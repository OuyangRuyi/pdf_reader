import google.generativeai as genai
from google import genai as genai_v2
from google.genai import types
from PIL import Image
import os
import asyncio
import uuid

class GeminiClient:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("Warning: GEMINI_API_KEY not set")
        else:
            genai.configure(api_key=api_key)
            # Using gemini-2.0-flash as it is faster and more stable
            self.model = genai.GenerativeModel('gemini-2.0-flash')
            
            # Initialize V2 client for image generation
            self.client_v2 = genai_v2.Client(api_key=api_key)

    async def generate_image(self, prompt: str) -> str:
        """
        Generates an image using Gemini 2.5 Flash Image (Nano Banana) and saves it to disk.
        Returns the relative URL path to the image.
        """
        if not hasattr(self, 'client_v2'):
            return None

        print(f"Generating image for prompt: {prompt[:50]}...")
        try:
            # Run the synchronous generate_content in a thread pool to avoid blocking
            response = await asyncio.to_thread(
                self.client_v2.models.generate_content,
                model="gemini-2.5-flash-image",
                contents=[prompt],
            )
            
            for part in response.parts:
                if part.inline_data is not None:
                    # Generate unique filename
                    filename = f"{uuid.uuid4()}.png"
                    filepath = os.path.join("data/uploads", filename)
                    
                    # Save image
                    image = part.as_image()
                    image.save(filepath)
                    print(f"Image saved to {filepath}")
                    
                    return f"/uploads/{filename}"
            
            print("No image data found in response")
            return None
            
        except Exception as e:
            print(f"Error generating image: {e}")
            return None

    async def generate_text(self, prompt: str) -> str:
        """
        Generic action to generate text content from Gemini.
        """
        if not hasattr(self, 'model'):
            return "Gemini API Key not configured."
            
        print(f"Sending request to Gemini (length: {len(prompt)} chars)...")
        try:
            response = await asyncio.wait_for(
                self.model.generate_content_async(prompt),
                timeout=30.0
            )
            return response.text
        except asyncio.TimeoutError:
            print("Gemini request timed out.")
            return "Error: Gemini API request timed out."
        except Exception as e:
            print(f"Gemini error: {e}")
            return f"Error calling Gemini: {str(e)}"

    async def summarize_page(self, page_text: str) -> str:
        prompt = f"""
        You are an assistant for reading research papers.
        Please summarize the following page in 3-5 bullet points.
        
        Page text:
        {page_text}
        """
        return await self.generate_text(prompt)

    async def summarize_document(self, full_text: str) -> str:
        prompt = f"""
        You are an expert academic researcher. 
        Please provide a comprehensive structured summary of the following research paper text.
        
        Structure your response as:
        1. **Research Problem**: What is the paper trying to solve?
        2. **Methodology**: How did they solve it?
        3. **Key Findings**: What are the main results?
        4. **Conclusion**: What is the significance?
        
        Text:
        {full_text[:30000]} 
        """
        # Truncate to avoid token limits if necessary, though Flash has large context
        return await self.generate_text(prompt)

    async def chat(self, history: list, context: str, question: str) -> str:
        if not hasattr(self, 'model'):
            return "Gemini API Key not configured."

        # Construct a simple chat prompt with history
        # Note: For a real chat session, we should use model.start_chat()
        # But for this stateless request, we'll just append history to prompt
        
        history_text = ""
        for msg in history[-5:]: # Last 5 messages
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            history_text += f"{role}: {content}\n"
            
        prompt = f"""
        You are a helpful research assistant.
        Context from the current page:
        {context}
        
        Chat History:
        {history_text}
        
        User Question: {question}
        
        Answer:
        """
        return await self.generate_text(prompt)

