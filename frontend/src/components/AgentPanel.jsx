import React, { useState, useRef, useEffect } from 'react';
import { runAgentTask, chatWithAgent, saveChatHistory, activeReading, skimPaper, getDocFigures, analyzeFigure, resolveReference } from '../services/api';
import { Loader2, Plus, Sparkles, PenTool, Send, Bot, Image as ImageIcon, Trash2, Settings, GraduationCap, Square, BookOpen, Layout, Image as GalleryIcon } from 'lucide-react';
import ModelSelector from './ModelSelector';
import FullscreenModal from './Modal/FullscreenModal';
import axios from 'axios';
import { ragQuery } from '../services/api';

const AgentPanel = ({ docId, currentPage, onAddNote, initialMessages = [], currentDocMeta, onPageChange, pendingFigureAnalysis, onFigureAnalysisComplete, figures = [] }) => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentModelInfo, setCurrentModelInfo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [ragQuerying, setRagQuerying] = useState(false);
  const abortControllerRef = useRef(null);

  // Handle pending figure analysis from App.jsx
  useEffect(() => {
    if (pendingFigureAnalysis && docId) {
      handleFigureClick(pendingFigureAnalysis);
      onFigureAnalysisComplete();
    }
  }, [pendingFigureAnalysis, docId]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setRagQuerying(false);
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: 'Generation stopped by user.',
        timestamp: Date.now()
      }]);
    }
  };

  // Sync initial messages when docId or initialMessages change
  useEffect(() => {
    if (docId) {
      console.log("Loading initial messages:", initialMessages); // Debug log
      // Ensure proper message structure when loading from storage
      const formattedMessages = (initialMessages || []).map(msg => ({
        role: msg.role,
        content: msg.content,
        card: msg.card,
        activeReadingCards: msg.activeReadingCards,
        page: msg.page,
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
          activeReadingCards: msg.activeReadingCards,
          page: msg.page,
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

  const handleFigureClick = async (fig) => {
    setLoading(true);
    try {
      const analysis = await analyzeFigure(docId, fig);
      
      if (analysis.error) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `❌ Figure analysis failed: ${analysis.error}`,
          timestamp: Date.now()
        }]);
        return;
      }

      // Standardize title: Fig. ? Analysis
      const figMatch = fig.caption.match(/Fig(?:ure)?\.?\s*(\d+)/i);
      const figTitle = figMatch ? `Fig. ${figMatch[1]} Analysis` : `Figure Analysis`;

      const figMessage = {
        role: 'assistant',
        content: `I've analyzed the figure for you:`,
        card: {
          id: `fig-analysis-${Date.now()}`,
          type: 'image',
          title: figTitle,
          content: analysis.explanation,
          page: fig.page,
          // imageUrl: fig.imageUrl, // Removed image from analysis output as requested
          figureData: fig
        },
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, figMessage]);
    } catch (error) {
      console.error('Figure analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReferenceClick = async (refText, e) => {
    if (e) e.stopPropagation();
    
    // 1. Check if it's a Figure/Table reference and we have it in our figures list
    const figMatch = refText.match(/(Fig\.|Figure|Table)\s*(\d+)/i);
    if (figMatch && figures.length > 0) {
      const num = figMatch[2];
      const type = figMatch[1].toLowerCase().startsWith('t') ? 'Table' : 'Figure';
      
      // Try to find the figure by caption matching
      const targetFig = figures.find(f => {
        const cap = f.caption.toLowerCase();
        return cap.includes(`${type.toLowerCase()} ${num}`) || cap.includes(`fig. ${num}`);
      });
      
      if (targetFig && onPageChange) {
        onPageChange(targetFig.page);
        return;
      }
    }

    // 2. Fallback to backend search for other references (Sections, Equations, etc.)
    try {
      const result = await resolveReference(docId, refText);
      if (result && onPageChange) {
        onPageChange(result.page);
      }
    } catch (error) {
      console.error('Failed to resolve reference:', error);
    }
  };

  const renderContentWithRefs = (content) => {
    if (!content) return null;
    
    // Regex for Fig. X, Figure X, Table X, Section X, Eq. X
    const refRegex = /(Fig\.|Figure|Table|Section|Eq\.)\s*(\d+(\.\d+)*)/gi;
    
    const parts = content.split(refRegex);
    if (parts.length === 1) return content;
    
    const elements = [];
    let lastIndex = 0;
    let match;
    
    // Reset regex index
    refRegex.lastIndex = 0;
    
    while ((match = refRegex.exec(content)) !== null) {
      // Add text before match
      elements.push(content.substring(lastIndex, match.index));
      
      // Add clickable reference
      const refText = match[0];
      elements.push(
        <span 
          key={match.index}
          onClick={(e) => handleReferenceClick(refText, e)}
          style={{ 
            color: 'var(--primary)', 
            textDecoration: 'underline', 
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          {refText}
        </span>
      );
      
      lastIndex = refRegex.lastIndex;
    }
    
    // Add remaining text
    elements.push(content.substring(lastIndex));
    
    return elements;
  };

  const handleTask = async (taskType) => {
    if (!docId) return;

    const action = quickActions[taskType];
    if (!action) return;

    // Add user message first
    const userMsg = { role: 'user', content: action.userMessage };
    setMessages(prev => [...prev, userMsg]);

    setLoading(true);
    abortControllerRef.current = new AbortController();
    try {
      const response = await runAgentTask(docId, currentPage, taskType, abortControllerRef.current.signal);
      const newMessages = response.cards.map(card => ({
        role: 'assistant',
        card: {
          ...card,
          question: action.userMessage // Store the triggering question
        }
      }));
      setMessages(prev => [...prev, ...newMessages]);
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Task aborted');
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Error: " + err.message }]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !docId || loading) return;

    const userMsg = { role: 'user', content: input };
    const userQuestion = input.trim(); // Store the user question
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const history = messages
        .filter(m => m.content)
        .map(m => ({ role: m.role, content: m.content }));

      const card = await chatWithAgent(docId, currentPage, userQuestion, history, abortControllerRef.current.signal);
      setMessages(prev => [...prev, {
        role: 'assistant',
        card: {
          ...card,
          question: userQuestion // Store the user's question with the card
        }
      }]);
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Chat aborted');
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Error: " + err.message }]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleActiveReading = async () => {
    if (!docId || loading) return;

    setLoading(true);
    abortControllerRef.current = new AbortController();
    try {
      const response = await activeReading(docId, currentPage, abortControllerRef.current.signal);
      // Add a system/assistant message with the cards
      const mentorMsg = {
        role: 'assistant',
        content: `Based on page ${currentPage}, here are some critical questions to guide your reading:`,
        activeReadingCards: response.cards,
        page: currentPage,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, mentorMsg]);
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Active reading aborted');
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Error: " + err.message }]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
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
        activeReadingCards: msg.activeReadingCards,
        page: msg.page,
        timestamp: msg.timestamp || Date.now()
      }));
      saveChatHistory(docId, fullMessages).catch(err => console.error("Failed to save chat history", err));
    }
  };

  const handleMessageClick = (message, e) => {
    // Prevent modal from opening when clicking buttons or mentor cards
    if (e.target.closest('.icon-btn') ||
      e.target.closest('.add-notebook-btn') ||
      e.target.closest('.message-delete-btn') ||
      e.target.closest('.mentor-card-hover') ||
      message.activeReadingCards) {
      return;
    }

    // Create modal content based on message type
    let modalContent = {
      title: '',
      content: '',
      images: []
    };

    if (message.role === 'user') {
      modalContent.title = 'User Message';
      modalContent.content = message.content || '';
    } else {
      // Assistant message
      modalContent.title = message.card?.title || 'AI Response';
      
      // If it's a card message, the card content is usually the "full" version
      if (message.card) {
        modalContent.content = message.card.content;
        // If there's a separate intro message, prepend it
        if (message.content && !message.content.startsWith('###')) {
          modalContent.content = message.content + '\n\n' + modalContent.content;
        }
      } else {
        modalContent.content = message.content || '';
      }
      
      if (message.card?.imageUrl) {
        modalContent.images = [message.card.imageUrl];
      }
    }

    setSelectedMessage(modalContent);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMessage(null);
  };

  const handleRagQuery = async () => {
    if (!input.trim()) {
      alert('Please enter a question!');
      return;
    }

    // Check if current doc is embedded
    if (docId && currentDocMeta && currentDocMeta.embedding_status !== 'completed') {
      const proceed = window.confirm("The current document has not been embedded yet. It will not be included in the RAG search. Do you want to proceed with other embedded documents?");
      if (!proceed) return;
    }

    setRagQuerying(true);
    abortControllerRef.current = new AbortController();
    const userMsg = { role: 'user', content: input };
    const userQuestion = input.trim();
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const response = await ragQuery(userQuestion, abortControllerRef.current.signal);

      // 不再在前端拼接检索内容，只在折叠框显示
      setMessages(prev => [...prev, {
        role: 'assistant',
        card: {
          id: response.id || Date.now().toString(),
          type: 'text',
          title: 'RAG Query Result',
          content: response.answer,  // 只显示 AI 的回答或错误信息
          page: currentPage,
          createdAt: new Date().toISOString(),
          // 添加检索信息到 card（用于折叠框显示）
          ragContext: {
            chunks: response.context_chunks || [],
            totalDocs: response.total_docs_searched || 0
          }
        }
      }]);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('RAG query aborted');
      } else {
        console.error('RAG query failed:', error);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "RAG query error: " + (error.response?.data?.detail || error.message)
        }]);
      }
    } finally {
      setRagQuerying(false);
      abortControllerRef.current = null;
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
          <div className="context-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  className={`message ${msg.role} clickable-card`}
                  style={{ position: 'relative', cursor: 'pointer' }}
                  onClick={(e) => handleMessageClick(msg, e)}
                  title="Click to view detailed content"
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

                  {/* 如果是 RAG 查询结果，显示可点击的按钮 */}
                  {msg.card && msg.card.ragContext && msg.card.ragContext.chunks.length > 0 && (
                    <div style={{
                      marginBottom: '1rem'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // 阻止触发消息点击

                          // 构建检索内容的显示
                          let contextContent = `**Retrieved Document Fragments** (${msg.card.ragContext.chunks.length} fragments from ${msg.card.ragContext.totalDocs} documents)\n\n`;

                          msg.card.ragContext.chunks.forEach((chunk, idx) => {
                            contextContent += `**Fragment ${idx + 1}** (Doc: ${chunk.doc_id.substring(0, 8)}..., Similarity: ${(chunk.similarity_score * 100).toFixed(1)}%)\n`;
                            contextContent += `${chunk.chunk}\n\n`;
                          });

                          // 打开弹窗
                          setSelectedMessage({
                            title: 'Retrieved Context',
                            content: contextContent,
                            images: []
                          });
                          setIsModalOpen(true);
                        }}
                        style={{
                          cursor: 'pointer',
                          fontWeight: 600,
                          color: 'var(--primary)',
                          backgroundColor: 'var(--bg-secondary)',
                          border: 'none',
                          padding: '0.75rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          width: '100%',
                          textAlign: 'left',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.target.style.opacity = '1'}
                      >
                        📚 View Retrieved Context ({msg.card.ragContext.chunks.length} fragments from {msg.card.ragContext.totalDocs} docs)
                      </button>
                    </div>
                  )}

                  {/* 普通消息：正常显示 */}
                  <>
                    {msg.content && <div style={{ whiteSpace: 'pre-wrap' }}>{renderContentWithRefs(msg.content)}</div>}
                    
                    {/* Active Reading Cards */}
                    {msg.activeReadingCards && (
                      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {msg.activeReadingCards.map((card, idx) => (
                          <div 
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setInput(card.question);
                            }}
                            style={{
                              padding: '0.75rem',
                              borderRadius: '8px',
                              background: 'rgba(var(--primary-rgb), 0.05)',
                              border: '1px solid rgba(var(--primary-rgb), 0.1)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            className="mentor-card-hover"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <span style={{ 
                                fontSize: '0.7rem', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                background: 'var(--primary)', 
                                color: 'white',
                                textTransform: 'uppercase',
                                fontWeight: 'bold'
                              }}>
                                {card.type}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                Page {msg.page || currentPage}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                {card.reason}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                              {card.question}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

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
                          {renderContentWithRefs(msg.card.content)}
                        </div>

                        <button
                          className="add-notebook-btn"
                          onClick={() => onAddNote({
                            ...msg.card,
                            question: msg.card.question
                          })}
                          style={{ marginTop: '0.75rem' }}
                        >
                          <Plus size={12} /> Add to Notebook
                        </button>

                        {msg.card.figureData && (
                          <button
                            className="add-notebook-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPageChange(msg.card.figureData.page);
                            }}
                            style={{ marginTop: '0.5rem', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}
                          >
                            <Layout size={12} /> Jump to Original
                          </button>
                        )}
                      </div>
                    )}
                  </>
                </div>
              ))}

              {loading && (
                <div className="message assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 className="loading-spinner" size={14} />
                  <span style={{ fontSize: '0.8rem' }}>Thinking...</span>
                  <button 
                    onClick={handleStop}
                    style={{
                      marginLeft: 'auto',
                      background: 'rgba(255, 0, 0, 0.1)',
                      border: '1px solid rgba(255, 0, 0, 0.2)',
                      color: '#ff4d4f',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Square size={10} fill="#ff4d4f" /> Stop
                  </button>
                </div>
              )}

              {ragQuerying && (
                <div className="message assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 className="loading-spinner" size={14} />
                  <span style={{ fontSize: '0.8rem' }}>Searching & Thinking...</span>
                  <button 
                    onClick={handleStop}
                    style={{
                      marginLeft: 'auto',
                      background: 'rgba(255, 0, 0, 0.1)',
                      border: '1px solid rgba(255, 0, 0, 0.2)',
                      color: '#ff4d4f',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Square size={10} fill="#ff4d4f" /> Stop
                  </button>
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
                disabled={loading || ragQuerying}
                rows={1}
                className="chat-input"
              />
              {/* RAG 查询按钮 */}
              <button
                className="icon-btn"
                onClick={handleRagQuery}
                disabled={ragQuerying || !input.trim()}
                title="Use RAG to query uploaded PDFs"
                style={{
                  color: input.trim() ? 'var(--primary)' : 'var(--text-dim)',
                  opacity: ragQuerying ? 0.6 : 1,
                  marginRight: '0.25rem'
                }}
              >
                {ragQuerying ? (
                  <Loader2 size={18} className="loading-spinner" />
                ) : (
                  <Sparkles size={18} />
                )}
              </button>
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
              <button
                className="action-chip mentor"
                onClick={handleActiveReading}
                disabled={loading || !docId}
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  color: 'white',
                  border: 'none'
                }}
              >
                <GraduationCap size={12} /> Reading Guide
              </button>

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

      {/* Fullscreen Modal */}
      <FullscreenModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedMessage?.title}
        content={selectedMessage?.content}
        images={selectedMessage?.images}
        isEditable={false}
      />

    </>
  );
};

export default AgentPanel;
