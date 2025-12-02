import React, { useState } from 'react';
import { Trash2, Download, Loader2, BookOpen, ChevronDown, ChevronUp, Sparkles, PenTool } from 'lucide-react';
import FullscreenModal from './Modal/FullscreenModal';

const NotebookPanel = ({ notes, onRemoveNote, onExportMarkdown, isGeneratingSummary, onGenerateSummary, onGenerateDiagram, docId }) => {
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [selectedNote, setSelectedNote] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const getTagClass = (type) => {
    if (type === 'overview') return 'tag-overview';
    if (type === 'page_summary' || type === 'summary') return 'tag-summary';
    if (type === 'diagram' || type === 'image') return 'tag-diagram';
    return 'tag-default';
  };

  const formatType = (type) => {
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
        <button className="icon-btn" onClick={onExportMarkdown} title="Export as ZIP (Markdown + Images)">
          <Download size={18} />
        </button>
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
                <span>{note.page ? `Page ${note.page}` : 'General'}</span>
                <span>{new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Document-level action buttons */}
      {docId && (
        <div className="panel-footer">
          <div className="action-buttons">
            <button 
              className="action-btn primary"
              onClick={onGenerateSummary}
              disabled={isGeneratingSummary}
            >
              <Sparkles size={16} />
              Document Summary
            </button>
            <button 
              className="action-btn secondary"
              onClick={onGenerateDiagram}
              disabled={isGeneratingSummary}
            >
              <PenTool size={16} />
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
      />

    </>
  );
};

export default NotebookPanel;
