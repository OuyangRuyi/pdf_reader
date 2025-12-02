import React, { useState, useRef, useEffect } from 'react';
import { runAgentTask, chatWithAgent, saveChatHistory } from '../services/api';
import { Loader2, Plus, Sparkles, PenTool, Send, Bot, Zap, Image as ImageIcon, Trash2 } from 'lucide-react';
import ModelSelector from './ModelSelector';

const AgentPanel = ({ docId, currentPage, onAddNote, initialMessages = [] }) => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentModelInfo, setCurrentModelInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync initial messages when docId or initialMessages change
  useEffect(() => {
    if (docId) {
      console.log("Loading initial messages:", initialMessages); // Debug log
      // Ensure proper message structure when loading from storage
      const formattedMessages = (initialMessages || []).map(msg => ({
        role: msg.role,
        content: msg.content,
        card: msg.card,
        timestamp: msg.timestamp
      }));
      setMessages(formattedMessages);
    } else {
      setMessages([]);
    }
  }, [docId, initialMessages]);

  // Auto-save chat history
  useEffect(() => {
    if (docId && messages.length > 0) {
      const timer = setTimeout(() => {
        console.log("Saving chat history:", messages); // Debug log
        // Ensure we save the full message objects including card data
        const fullMessages = messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          card: msg.card, // Make sure card data is included
          timestamp: msg.timestamp || Date.now()
        }));
        saveChatHistory(docId, fullMessages).catch(err => console.error("Failed to save chat history", err));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [messages, docId]);

  const handleModelChange = (newModelInfo) => {
    setCurrentModelInfo(newModelInfo);
    // Add a system message about model change
    const systemMsg = {
      role: 'system',
      content: `Switched to ${newModelInfo.name} (${newModelInfo.provider})`
    };
    setMessages(prev => [...prev, systemMsg]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Quick action button configurations
  const quickActions = {
    'summarize_page': {
      label: 'Summarize',
      icon: <Sparkles size={12} />,
      userMessage: `Please summarize the main content of the current page ${currentPage}.`
    },
    'draw_diagram_page': {
      label: 'Draw Diagram',
      icon: <PenTool size={12} />,
      userMessage: `Please draw a diagram based on the content of the current page ${currentPage}.`
    }
  };

  const handleTask = async (taskType) => {
    if (!docId) return;
    
    const action = quickActions[taskType];
    if (!action) return;

    // Add user message first
    const userMsg = { role: 'user', content: action.userMessage };
    setMessages(prev => [...prev, userMsg]);
    
    setLoading(true);
    try {
      const response = await runAgentTask(docId, currentPage, taskType);
      const newMessages = response.cards.map(card => ({
        role: 'assistant',
        card: {
          ...card,
          question: action.userMessage // Store the triggering question
        }
      }));
      setMessages(prev => [...prev, ...newMessages]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !docId || loading) return;

    const userMsg = { role: 'user', content: input };
    const userQuestion = input.trim(); // Store the user question
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.content)
        .map(m => ({ role: m.role, content: m.content }));

      const card = await chatWithAgent(docId, currentPage, userQuestion, history);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        card: {
          ...card,
          question: userQuestion // Store the user's question with the card
        }
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteMessage = (indexToDelete) => {
    const updatedMessages = messages.filter((_, index) => index !== indexToDelete);
    setMessages(updatedMessages);
    // Auto-save updated chat history
    if (docId) {
      const fullMessages = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
        card: msg.card,
        timestamp: msg.timestamp || Date.now()
      }));
      saveChatHistory(docId, fullMessages).catch(err => console.error("Failed to save chat history", err));
    }
  };



  return (
    <>
      <div className="panel-header">
        <h2>
          <Bot size={18} color="var(--primary)" />
          Agent Console
        </h2>
        <ModelSelector onModelChange={handleModelChange} />
      </div>
      
      {!docId ? (
        <div className="panel-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-dim)' }}>Please upload a PDF to start.</p>
        </div>
      ) : (
        <>
          {/* Context Bar */}
          <div className="context-bar">
            <div className="context-chip">
              Context: Page {currentPage}
            </div>
          </div>

          {/* Chat Area */}
          <div className="chat-area">
            <div className="messages-container">
              {messages.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  color: 'var(--text-dim)', 
                  marginTop: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <Bot size={32} style={{ opacity: 0.2 }} />
                  <p style={{ fontSize: '0.9rem', margin: 0 }}>I'm ready to help you analyze this paper.</p>
                </div>
              )}
              
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`message ${msg.role}`}
                  style={{ position: 'relative' }}
                >
                  <button 
                    className="icon-btn message-delete-btn"
                    onClick={() => handleDeleteMessage(idx)}
                    title="Delete message"
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      padding: '2px',
                      opacity: '0.6',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '1'}
                    onMouseLeave={(e) => e.target.style.opacity = '0.6'}
                  >
                    <Trash2 size={14} />
                  </button>
                  {msg.content && <div>{msg.content}</div>}
                  
                  {msg.card && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary)' }}>
                        {msg.card.title}
                      </div>
                      {msg.card.imageUrl && (
                        <div className="message-card-preview" style={{ marginBottom: '0.5rem' }}>
                          <img 
                            src={msg.card.imageUrl} 
                            alt="Generated" 
                            style={{ width: '100%', borderRadius: '4px' }} 
                            onError={(e) => {
                              console.log('AgentPanel image load error:', e.target.src);
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div style={{ 
                        fontSize: '0.85rem', 
                        opacity: 0.9, 
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.5
                      }}>
                        {msg.card.content}
                      </div>
                      
                      <button 
                        className="add-notebook-btn" 
                        onClick={() => onAddNote({
                          ...msg.card,
                          question: msg.card.question // Include the question that triggered this
                        })}
                        style={{ marginTop: '0.75rem' }}
                      >
                        <Plus size={12} /> Add to Notebook
                      </button>
                    </div>
                  )}
                </div>
              ))}
              
              {loading && (
                <div className="message assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 className="loading-spinner" size={14} />
                  <span style={{ fontSize: '0.8rem' }}>Thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="input-area">
            <div className="chat-input-wrapper">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about this paper..."
                disabled={loading}
                rows={1}
                className="chat-input"
              />
              <button 
                className="icon-btn" 
                onClick={handleSend} 
                disabled={loading || !input.trim()}
                style={{ color: input.trim() ? 'var(--primary)' : 'var(--text-dim)' }}
              >
                <Send size={18} />
              </button>
            </div>
            
            {/* Quick Actions */}
            <div className="quick-actions">
              {Object.entries(quickActions).map(([taskType, action]) => (
                <button 
                  key={taskType}
                  className="action-chip" 
                  onClick={() => handleTask(taskType)} 
                  disabled={loading}
                >
                  {action.icon} {action.label}
                </button>
              ))}
              
              {messages.length > 0 && (
                <button 
                  className="action-chip danger" 
                  onClick={() => {
                    if (confirm('Clear all chat history?')) {
                      setMessages([]);
                      if (docId) {
                        saveChatHistory(docId, []).catch(err => console.error("Failed to clear chat history", err));
                      }
                    }
                  }}
                  disabled={loading}
                  title="Clear all messages"
                >
                  🗑️ Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}

    </>
  );
};

export default AgentPanel;
