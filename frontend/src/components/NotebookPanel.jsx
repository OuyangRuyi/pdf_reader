import React, { useState } from 'react';
import { Trash2, Download, Loader2, BookOpen, ChevronDown, ChevronUp, Sparkles, PenTool, Settings, User, Square, Layout, Image as ImageIcon, X, Search } from 'lucide-react';
import FullscreenModal from './Modal/FullscreenModal';

const NotebookPanel = ({ notes, onRemoveNote, onUpdateNote, onExportMarkdown, isGeneratingSummary, onGenerateSummary, onGenerateDiagram, onStopGeneration, onOpenConfig, onOpenProfile, docId, onAnalyzePaper, onShowFigures, onPageChange, figures = [], showFigures = false, setShowFigures, onAnalyzeFigure }) => {
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [selectedNote, setSelectedNote] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingFigureAnalysis, setPendingFigureAnalysis] = useState(null);
  
  const getTagClass = (type) => {
    if (type === 'overview') return 'tag-overview';
    if (type === 'page_summary' || type === 'summary') return 'tag-summary';
    if (type === 'diagram' || type === 'image') return 'tag-diagram';
    return 'tag-default';
  };

  const formatType = (type) => {
    if (!type) return 'Note';
    return type.replace(/_/g, ' ');
  };

  const toggleNoteExpansion = (noteId) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNotes(newExpanded);
  };

  // Check if content is long enough to need expansion
  const needsExpansion = (content) => {
    return content && content.length > 120;
  };

  const handleNoteClick = (note, e) => {
    // Prevent modal from opening when clicking expand/delete buttons
    if (e.target.closest('.icon-btn') || e.target.closest('.note-expand-btn')) {
      return;
    }
    setSelectedNote(note);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedNote(null);
  };



  return (
    <>
      <div className="panel-header">
        <h2>
          <BookOpen size={18} color="var(--primary)" />
          Notebook
          <span className="subtitle">Extracted Insights</span>
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="icon-btn" onClick={onOpenProfile} title="Personal Memory">
            <User size={18} />
          </button>
          <button className="icon-btn" onClick={onOpenConfig} title="Settings">
            <Settings size={18} />
          </button>
          <button className="icon-btn" onClick={onExportMarkdown} title="Export as ZIP (Markdown + Images)">
            <Download size={18} />
          </button>
        </div>
      </div>

      <div className="panel-content">
        {isGeneratingSummary && (
          <div style={{ 
            padding: '1rem', 
            background: 'rgba(6, 182, 212, 0.1)', 
            border: '1px solid rgba(6, 182, 212, 0.2)', 
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--primary)',
            fontSize: '0.85rem'
          }}>
            <Loader2 className="loading-spinner" size={16} />
            <span>Analyzing document...</span>
            <button 
              onClick={onStopGeneration}
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

        {notes.length === 0 && !isGeneratingSummary ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-dim)' }}>
            <p style={{ fontSize: '0.9rem' }}>No notes yet.</p>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Ask the Agent to summarize pages or explain concepts.</p>
          </div>
        ) : (
          notes.map((note) => (
            <div 
              key={note.id} 
              className={`note-card ${expandedNotes.has(note.id) ? 'expanded' : ''} clickable-card`}
              onClick={(e) => handleNoteClick(note, e)}
              title="Click to view detailed content"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className={`note-tag ${getTagClass(note.type)}`}>
                  {formatType(note.type)}
                </span>
                <button 
                  className="icon-btn"
                  onClick={() => onRemoveNote(note.id)} 
                  title="Delete note"
                  style={{ padding: '2px', opacity: 0.6 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <h4 className="note-title">{note.title}</h4>
              
              {/* Show user question if available */}
              {note.question && (
                <div className="note-question">
                  Q: {note.question}
                </div>
              )}
              
              {note.imageUrl && !note.imageUrl.endsWith('.pdf') && (
                <div style={{ marginBottom: '0.75rem', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                  <img 
                    src={note.imageUrl} 
                    alt="Note Image" 
                    style={{ width: '100%', display: 'block' }} 
                    onError={(e) => {
                      console.log('NotebookPanel image load error:', e.target.src);
                      e.target.parentElement.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className={`note-content ${
                needsExpansion(note.content) && !expandedNotes.has(note.id) 
                  ? 'collapsed' 
                  : expandedNotes.has(note.id) 
                    ? 'expanded' 
                    : ''
              }`}>
                {note.content}
              </div>
              
              {needsExpansion(note.content) && (
                <button 
                  className="note-expand-btn"
                  onClick={() => toggleNoteExpansion(note.id)}
                >
                  {expandedNotes.has(note.id) ? (
                    <>
                      <ChevronUp size={14} />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      Show More
                    </>
                  )}
                </button>
              )}
              
              <div className="note-meta">
                <span 
                  onClick={(e) => {
                    if (note.page && onPageChange) {
                      e.stopPropagation();
                      onPageChange(note.page);
                    }
                  }}
                  style={{ 
                    cursor: note.page ? 'pointer' : 'default', 
                    color: note.page ? 'var(--primary)' : 'inherit',
                    fontWeight: note.page ? 600 : 400
                  }}
                  title={note.page ? "Click to jump to page" : ""}
                >
                  {note.page ? `Page ${note.page}` : 'General'}
                </span>
                <span>{new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Document-level action buttons */}
      {docId && (
        <div className="panel-footer" style={{ position: 'relative' }}>
          {/* Figures Gallery Popover */}
          {showFigures && (
            <div className="panel-glass" style={{
              position: 'absolute',
              bottom: '100%',
              left: '0',
              right: '0',
              maxHeight: '400px',
              marginBottom: '0.5rem',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden'
            }}>
              <div className="panel-header" style={{ padding: '0.5rem 1rem' }}>
                <h3 style={{ fontSize: '0.9rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ImageIcon size={14} /> Figures Gallery
                </h3>
                <button className="icon-btn" onClick={() => setShowFigures(false)}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ 
                padding: '0.75rem', 
                overflowY: 'auto', 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', 
                gap: '0.75rem',
                background: 'var(--bg-primary)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {figures.length === 0 ? (
                  <p style={{ textAlign: 'center', gridColumn: '1/-1', color: 'var(--text-dim)', fontSize: '0.8rem' }}>No figures detected.</p>
                ) : (
                  figures.map((fig, idx) => (
                    <div 
                      key={idx} 
                      className="clickable-card" 
                      style={{ 
                        padding: '0.5rem', 
                        borderRadius: '6px', 
                        border: '1px solid var(--glass-border)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      {fig.imageUrl && (
                        <div style={{ width: '100%', height: '80px', overflow: 'hidden', borderRadius: '4px', background: '#eee' }}>
                          <img src={fig.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span 
                          style={{ 
                            fontSize: '0.65rem', 
                            color: 'var(--primary)', 
                            fontWeight: 600,
                            padding: '2px 4px',
                            borderRadius: '4px',
                            background: 'rgba(59, 130, 246, 0.1)'
                          }}
                        >
                          P{fig.page}
                        </span>
                        <button 
                          className="icon-btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onPageChange(fig.page);
                          }}
                          title="Jump to PDF"
                          style={{ padding: '2px' }}
                        >
                          <Search size={12} />
                        </button>
                      </div>
                      <div 
                        style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 500, 
                          display: '-webkit-box', 
                          WebkitLineClamp: 2, 
                          WebkitBoxOrient: 'vertical', 
                          overflow: 'hidden',
                          cursor: 'pointer',
                          lineHeight: '1.2'
                        }}
                        onClick={() => onAnalyzeFigure(fig)}
                        title="Click to analyze"
                      >
                        {fig.caption}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="action-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button 
              className="action-btn primary"
              onClick={onAnalyzePaper}
              disabled={isGeneratingSummary}
              style={{ padding: '0.5rem', fontSize: '0.8rem', gridColumn: '1 / -1' }}
            >
              <Sparkles size={14} />
              Full Paper Analysis
            </button>
            <button 
              className="action-btn secondary"
              onClick={onShowFigures}
              disabled={isGeneratingSummary}
              style={{ padding: '0.5rem', fontSize: '0.8rem' }}
            >
              <ImageIcon size={14} />
              Figures
            </button>
            <button 
              className="action-btn secondary"
              onClick={onGenerateDiagram}
              disabled={isGeneratingSummary}
              style={{ padding: '0.5rem', fontSize: '0.8rem' }}
            >
              <PenTool size={14} />
              Info Diagram
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      <FullscreenModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedNote?.title}
        content={selectedNote?.content}
        images={selectedNote?.imageUrl ? [selectedNote.imageUrl] : []}
        onSave={async (updatedData) => {
          await onUpdateNote(selectedNote.id, updatedData);
          setSelectedNote(prev => ({ ...prev, ...updatedData }));
        }}
      />

    </>
  );
};

export default NotebookPanel;
