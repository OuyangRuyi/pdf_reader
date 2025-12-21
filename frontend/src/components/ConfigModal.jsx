import React, { useState, useEffect } from 'react';
import { getConfigStatus, saveConfig } from '../services/api';
import './ConfigModal.css';

const ConfigModal = ({ isOpen, onClose, onConfigSaved }) => {
  const [config, setConfig] = useState({
    OPENAI_API_KEY: '',
    OPENAI_BASE_URL: '',
    GEMINI_API_KEY: '',
    GEMINI_BASE_URL: '',
    DEEPSEEK_API_KEY: '',
    DEEPSEEK_BASE_URL: '',
    ARK_API_KEY: '',
    ARK_BASE_URL: '',
    LANGUAGE: 'en'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const status = await getConfigStatus();
      if (status.config) {
        setConfig(status.config);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await saveConfig(config);
      if (result.status === 'success') {
        setMessage({ type: 'success', text: 'Configuration saved successfully!' });
        if (onConfigSaved) onConfigSaved();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: 'Failed to save configuration.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="config-modal-overlay">
      <div className="config-modal-content">
        <h2>System Configuration</h2>
        <p className="config-subtitle">Set your API keys and base URLs to get started.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="config-section">
            <h3>General Settings</h3>
            <div className="form-group">
              <label>Output Language</label>
              <select 
                name="LANGUAGE" 
                value={config.LANGUAGE} 
                onChange={handleChange}
                className="config-select"
              >
                <option value="en">English</option>
                <option value="zh">中文 (Chinese)</option>
              </select>
              <p className="field-hint">AI will generate summaries and answers in this language.</p>
            </div>
          </div>

          <div className="config-section">
            <h3>OpenAI / Embedding</h3>
            <div className="form-group">
              <label>OpenAI API Key</label>
              <input
                type="password"
                name="OPENAI_API_KEY"
                value={config.OPENAI_API_KEY}
                onChange={handleChange}
                placeholder="sk-..."
              />
            </div>
            <div className="form-group">
              <label>OpenAI Base URL</label>
              <input
                type="text"
                name="OPENAI_BASE_URL"
                value={config.OPENAI_BASE_URL}
                onChange={handleChange}
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </div>

          <div className="config-section">
            <h3>Other Providers (Optional)</h3>
            <div className="form-group">
              <label>Gemini API Key</label>
              <input
                type="password"
                name="GEMINI_API_KEY"
                value={config.GEMINI_API_KEY}
                onChange={handleChange}
                placeholder="AIza..."
              />
            </div>
            <div className="form-group">
              <label>Gemini Base URL (Optional)</label>
              <input
                type="text"
                name="GEMINI_BASE_URL"
                value={config.GEMINI_BASE_URL}
                onChange={handleChange}
                placeholder="https://generativelanguage.googleapis.com"
              />
            </div>
            <div className="form-group">
              <label>DeepSeek API Key</label>
              <input
                type="password"
                name="DEEPSEEK_API_KEY"
                value={config.DEEPSEEK_API_KEY}
                onChange={handleChange}
                placeholder="sk-..."
              />
            </div>
            <div className="form-group">
              <label>DeepSeek Base URL (Optional)</label>
              <input
                type="text"
                name="DEEPSEEK_BASE_URL"
                value={config.DEEPSEEK_BASE_URL}
                onChange={handleChange}
                placeholder="https://api.deepseek.com"
              />
            </div>
            <div className="form-group">
              <label>Ark (Doubao) API Key</label>
              <input
                type="password"
                name="ARK_API_KEY"
                value={config.ARK_API_KEY}
                onChange={handleChange}
                placeholder="API Key"
              />
            </div>
            <div className="form-group">
              <label>Ark Base URL (Optional)</label>
              <input
                type="text"
                name="ARK_BASE_URL"
                value={config.ARK_BASE_URL}
                onChange={handleChange}
                placeholder="https://ark.cn-beijing.volces.com/api/v3"
              />
            </div>
          </div>

          {message.text && (
            <div className={`config-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="config-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConfigModal;
