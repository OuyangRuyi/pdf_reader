import os
import json
from typing import Dict, Any, Optional

class ConfigService:
    def __init__(self):
        self.config_path = "data/config.json"
        os.makedirs("data", exist_ok=True)
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading config: {e}")
        
        return {}

    def save_config(self, new_config: Dict[str, Any]):
        self.config.update(new_config)
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            
            # Update environment variables for current process
            for key, value in new_config.items():
                if value:
                    os.environ[key] = value
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False

    def get(self, key: str, default: Any = None) -> Any:
        return self.config.get(key, default)

    def is_configured(self) -> bool:
        # Check if at least one major API key is set
        return any([
            self.get("OPENAI_API_KEY"),
            self.get("GEMINI_API_KEY"),
            self.get("DEEPSEEK_API_KEY"),
            self.get("ARK_API_KEY")
        ])
