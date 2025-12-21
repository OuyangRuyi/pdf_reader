import React, { useState, useEffect } from 'react';
import { ChevronDown, Check, Bot, Cpu, Zap } from 'lucide-react';
import { getAvailableModels, setCurrentModel, getCurrentModel } from '../services/api';

const ModelSelector = ({ onModelChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState({});
  const [currentModel, setCurrentModelState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    // 直接设置静态模型列表，不依赖后端API
    const staticModels = {
      "gemini-2.5-flash": {
        "name": "Gemini 2.5 Flash",
        "provider": "Google", 
        "supports_image": true,
        "model_id": "gemini-2.5-flash"
      },
      "gemini-3-pro-preview": {
        "name": "Gemini 3 Pro Preview",
        "provider": "Google", 
        "supports_image": true,
        "model_id": "gemini-3-pro-preview"
      },
      "deepseek-chat": {
        "name": "DeepSeek Chat",
        "provider": "DeepSeek",
        "supports_image": false,
        "model_id": "deepseek-chat"
      },
      "deepseek-reasoner": {
        "name": "DeepSeek Reasoner", 
        "provider": "DeepSeek",
        "supports_image": false,
        "model_id": "deepseek-reasoner"
      },
      "doubao": {
        "name": "Doubao Seed",
        "provider": "ByteDance",
        "supports_image": false,
        "model_id": "doubao"
      }
    };
    
    setModels(staticModels);
    
    // 先设置默认模型，这样界面立即可用
    setCurrentModelState(staticModels['gemini-2.5-flash']);
    setLoading(false);
    
    // 异步尝试获取后端的当前模型，如果成功就更新，失败就保持默认
    try {
      const currentModelInfo = await getCurrentModel();
      if (currentModelInfo && currentModelInfo.model_id) {
        setCurrentModelState(currentModelInfo);
      }
    } catch (error) {
      console.log('Backend not available, using default model:', error.message);
      // 不需要做任何事，保持默认模型
    }
  };

  const handleModelSelect = async (modelId) => {
    if (modelId === currentModel?.model_id || loading) return;
    
    setLoading(true);
    
    // 立即更新前端状态，不等待后端响应
    const selectedModel = models[modelId];
    if (selectedModel) {
      setCurrentModelState(selectedModel);
      if (onModelChange) {
        onModelChange(selectedModel);
      }
    }
    
    // 异步尝试通知后端，如果失败也不影响前端使用
    try {
      await setCurrentModel(modelId);
      console.log(`Successfully switched to ${modelId}`);
    } catch (error) {
      console.log(`Backend not available, model switch recorded locally:`, error.message);
      // 前端状态已经更新，后端失败不影响用户体验
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const getModelIcon = (provider) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return <Bot size={14} />;
      case 'deepseek':
        return <Cpu size={14} />;
      case 'bytedance':
        return <Zap size={14} />;
      default:
        return <Bot size={14} />;
    }
  };

  const getModelColor = (provider) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return '#4285f4';
      case 'deepseek':
        return '#ff6b35';
      case 'bytedance':
        return '#00d4aa';
      default:
        return 'var(--accent-green)';
    }
  };

  if (loading || !currentModel) {
    return (
      <div className="model-selector loading">
        <div className="model-badge">
          <div className="status-dot" style={{ background: '#fbbf24' }}></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <div 
        className={`model-badge clickable ${isOpen ? 'open' : ''}`}
        onClick={() => !loading && setIsOpen(!isOpen)}
        style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        <div 
          className={`status-dot ${loading ? 'thinking' : ''}`} 
          style={{ 
            background: loading ? '#fbbf24' : getModelColor(currentModel.provider),
            boxShadow: `0 0 8px ${getModelColor(currentModel.provider)}40`
          }}
        ></div>
        <span>{currentModel.name}</span>
        <ChevronDown 
          size={14} 
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
          style={{ 
            marginLeft: '0.5rem',
            transition: 'transform 0.2s ease',
            opacity: loading ? 0.5 : 1
          }}
        />
      </div>
      
      {isOpen && !loading && (
        <>
          <div className="model-dropdown-overlay" onClick={() => setIsOpen(false)} />
          <div className="model-dropdown">
            {Object.entries(models).map(([modelId, modelInfo]) => (
              <div
                key={modelId}
                className={`model-option ${currentModel?.model_id === modelId ? 'selected' : ''}`}
                onClick={() => handleModelSelect(modelId)}
              >
                <div className="model-option-main">
                  <div className="model-option-icon" style={{ color: getModelColor(modelInfo.provider) }}>
                    {getModelIcon(modelInfo.provider)}
                  </div>
                  <div className="model-option-info">
                    <div className="model-option-name">{modelInfo.name}</div>
                    <div className="model-option-provider">{modelInfo.provider}</div>
                  </div>
                </div>
                <div className="model-option-features">
                  {modelInfo.supports_image && (
                    <span className="feature-badge">🎨 Image</span>
                  )}
                  {currentModel?.model_id === modelId && (
                    <Check size={16} className="selected-check" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ModelSelector;