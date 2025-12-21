import os
import asyncio
import uuid
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import google.generativeai as genai
from google import genai as genai_v2
from openai import OpenAI
from volcenginesdkarkruntime import Ark
from .config_service import ConfigService

class BaseAIClient(ABC):
    """Base class for AI model clients"""
    
    @abstractmethod
    async def generate_text(self, prompt: str, **kwargs) -> str:
        """Generate text response"""
        pass
    
    @abstractmethod
    async def generate_image(self, prompt: str) -> Optional[str]:
        """Generate image and return URL path"""
        pass
    
    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        pass


class GeminiClient(BaseAIClient):
    def __init__(self, model_name="gemini-2.5-flash"):
        config = ConfigService()
        self.api_key = config.get("GEMINI_API_KEY")
        self.base_url = config.get("GEMINI_BASE_URL")
        self.model_name = model_name
        
        if not self.api_key:
            print(f"Warning: GEMINI_API_KEY not set for model {model_name}")
            self.available = False
            return
            
        try:
            # Configure with optional base_url (api_endpoint)
            client_options = None
            if self.base_url:
                from google.api_core import client_options as options
                client_options = options.ClientOptions(api_endpoint=self.base_url)
            
            genai.configure(api_key=self.api_key, client_options=client_options)
            self.model = genai.GenerativeModel(self.model_name)
            
            # V2 client also supports base_url
            if self.base_url:
                self.client_v2 = genai_v2.Client(api_key=self.api_key, http_options={'api_endpoint': self.base_url})
            else:
                self.client_v2 = genai_v2.Client(api_key=self.api_key)
                
            self.available = True
            print(f"Gemini client initialized successfully for {model_name}")
        except Exception as e:
            print(f"Failed to initialize Gemini client for {model_name}: {e}")
            self.available = False

    async def generate_text(self, prompt: str, **kwargs) -> str:
        if not getattr(self, 'available', False):
            raise Exception(f"Gemini client for {self.model_name} is not available (API key missing or initialization failed)")
        
        if not hasattr(self, 'model'):
            raise Exception("Gemini client not properly initialized")
        
        try:
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt
            )
            return response.text
        except Exception as e:
            raise Exception(f"Gemini text generation failed: {str(e)}")

    async def generate_image(self, prompt: str) -> Optional[str]:
        if not hasattr(self, 'client_v2'):
            return None

        try:
            # 根据当前模型选择对应的图像生成模型
            image_model = "gemini-2.5-flash-image"
            if "gemini-3-pro" in self.model_name:
                image_model = "gemini-3-pro-image-preview"
            
            response = await asyncio.to_thread(
                self.client_v2.models.generate_content,
                model=image_model,
                contents=[prompt],
            )
            
            for part in response.parts:
                if part.inline_data is not None:
                    filename = f"{uuid.uuid4()}.png"
                    filepath = os.path.join("data/uploads", filename)
                    
                    image = part.as_image()
                    image.save(filepath)
                    
                    return f"/uploads/{filename}"
        except Exception as e:
            print(f"Gemini image generation failed: {str(e)}")
            return None

    def get_model_info(self) -> Dict[str, Any]:
        model_names = {
            "gemini-2.5-flash": "Gemini 2.5 Flash",
            "gemini-3-pro-preview": "Gemini 3 Pro Preview"
        }
        return {
            "name": model_names.get(self.model_name, self.model_name),
            "provider": "Google",
            "supports_image": True,
            "model_id": self.model_name
        }


class DeepSeekClient(BaseAIClient):
    def __init__(self, model_type="chat"):
        config = ConfigService()
        self.api_key = config.get("DEEPSEEK_API_KEY")
        self.base_url = config.get("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"
        self.model_type = model_type
        self.model_name = "deepseek-chat" if model_type == "chat" else "deepseek-reasoner"
        
        if not self.api_key:
            print("Warning: DEEPSEEK_API_KEY not set")
            return
            
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )

    async def generate_text(self, prompt: str, **kwargs) -> str:
        if not hasattr(self, 'client'):
            raise Exception("DeepSeek client not properly initialized")
        
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant for reading research papers."},
                    {"role": "user", "content": prompt}
                ],
                stream=False
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"DeepSeek text generation failed: {str(e)}")

    async def generate_image(self, prompt: str) -> Optional[str]:
        # DeepSeek doesn't support image generation
        return None

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "name": "DeepSeek Chat" if self.model_type == "chat" else "DeepSeek Reasoner",
            "provider": "DeepSeek",
            "supports_image": False,
            "model_id": self.model_name
        }


class DoubaoClient(BaseAIClient):
    def __init__(self):
        config = ConfigService()
        self.api_key = config.get("ARK_API_KEY")
        self.base_url = config.get("ARK_BASE_URL") or "https://ark.cn-beijing.volces.com/api/v3"
        self.model_name = "doubao-seed-1-6-251015"
        
        if not self.api_key:
            print("Warning: ARK_API_KEY not set")
            return
            
        self.client = Ark(
            api_key=self.api_key,
            base_url=self.base_url
        )

    async def generate_text(self, prompt: str, **kwargs) -> str:
        if not hasattr(self, 'client'):
            raise Exception("Doubao client not properly initialized")
        
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.model_name,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"Doubao text generation failed: {str(e)}")

    async def generate_image(self, prompt: str) -> Optional[str]:
        # Doubao doesn't support image generation in this setup
        return None

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "name": "Doubao Seed",
            "provider": "ByteDance",
            "supports_image": False,
            "model_id": self.model_name
        }


class MultiModelClient:
    """Unified client that manages multiple AI model providers"""
    
    def __init__(self):
        self.clients = {}
        self.current_model = "gemini-2.5-flash"
        
        # Initialize available clients
        self._init_clients()
    
    def _init_clients(self):
        """Initialize all available AI clients"""
        try:
            self.clients["gemini-2.5-flash"] = GeminiClient("gemini-2.5-flash")
        except Exception as e:
            print(f"Failed to initialize Gemini 2.5 Flash client: {e}")
            
        try:
            self.clients["gemini-3-pro-preview"] = GeminiClient("gemini-3-pro-preview")
        except Exception as e:
            print(f"Failed to initialize Gemini 3 Pro Preview client: {e}")
        
        try:
            self.clients["deepseek-chat"] = DeepSeekClient("chat")
        except Exception as e:
            print(f"Failed to initialize DeepSeek Chat client: {e}")
            
        try:
            self.clients["deepseek-reasoner"] = DeepSeekClient("reasoner")
        except Exception as e:
            print(f"Failed to initialize DeepSeek Reasoner client: {e}")
        
        try:
            self.clients["doubao"] = DoubaoClient()
        except Exception as e:
            print(f"Failed to initialize Doubao client: {e}")
    
    def get_available_models(self) -> Dict[str, Dict[str, Any]]:
        """Get all available models with their info"""
        available = {}
        for model_id, client in self.clients.items():
            try:
                available[model_id] = client.get_model_info()
            except Exception as e:
                print(f"Failed to get info for {model_id}: {e}")
        return available
    
    def set_current_model(self, model_id: str) -> bool:
        """Set the current active model"""
        if model_id in self.clients:
            self.current_model = model_id
            return True
        return False
    
    def get_current_model_info(self) -> Dict[str, Any]:
        """Get current model information"""
        if self.current_model in self.clients:
            return self.clients[self.current_model].get_model_info()
        # 返回默认的 Gemini 2.5 Flash 信息
        return {
            "name": "Gemini 2.5 Flash", 
            "provider": "Google", 
            "supports_image": True, 
            "model_id": "gemini-2.5-flash"
        }
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        """Generate text using current model"""
        print(f"Generating text with model: {self.current_model}")
        print(f"Available clients: {list(self.clients.keys())}")
        
        if self.current_model not in self.clients:
            raise Exception(f"Model {self.current_model} not available. Available models: {list(self.clients.keys())}")
        
        client = self.clients[self.current_model]
        print(f"Using client: {type(client).__name__}")
        
        try:
            result = await client.generate_text(prompt, **kwargs)
            print(f"Generated text length: {len(result)}")
            return result
        except Exception as e:
            print(f"Error in generate_text: {e}")
            raise
    
    async def generate_image(self, prompt: str) -> Optional[str]:
        """Generate image using current model (if supported)"""
        if self.current_model not in self.clients:
            return None
        
        return await self.clients[self.current_model].generate_image(prompt)

    # Legacy methods for backward compatibility
    async def summarize_document(self, text: str) -> str:
        prompt = f"""
        You are an expert assistant for reading research papers. 
        Please provide a comprehensive summary of this document in structured format:

        **Main Topic & Objective:**
        - [Brief description of what this paper is about]

        **Key Contributions:**
        - [List 3-5 main contributions]

        **Methodology:**
        - [Brief overview of methods used]

        **Key Findings:**
        - [Important results and conclusions]

        Document content:
        {text}
        """
        return await self.generate_text(prompt)

    async def summarize_page(self, page_text: str) -> str:
        prompt = f"""
        You are an assistant for reading research papers.
        Please summarize the following page in 3-5 bullet points, focusing on the key concepts and findings.
        
        Page text:
        {page_text}
        """
        return await self.generate_text(prompt)

    async def explain_content(self, content: str, question: str) -> str:
        prompt = f"""
        You are an expert assistant helping someone understand a research paper.
        
        User question: {question}
        
        Content to analyze:
        {content}
        
        Please provide a clear, detailed explanation that directly answers the user's question.
        """
        return await self.generate_text(prompt)

    async def draw_diagram(self, content: str, instruction: str = None) -> Optional[str]:
        if instruction:
            prompt = f"Create a detailed technical diagram: {instruction}. Based on: {content[:500]}"
        else:
            prompt = f"Create a clear technical diagram explaining the concepts in: {content[:500]}"
        
        return await self.generate_image(prompt)