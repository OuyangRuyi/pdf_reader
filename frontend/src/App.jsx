import React, { useState, useEffect } from 'react';
import PDFViewer from './components/PDFViewer';
import NotebookPanel from './components/NotebookPanel';
import AgentPanel from './components/AgentPanel';
import { uploadPdf, getDocMeta, addNoteToDoc, deleteNoteFromDoc, getPdfUrl, initDocNotes } from './services/api';
import { Upload, Loader2 } from 'lucide-react';

function App() {
  const [docId, setDocId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [notes, setNotes] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Load notes when docId changes
  useEffect(() => {
    if (docId) {
      loadDocData(docId);
    }
  }, [docId]);

  const loadDocData = async (id) => {
    try {
      const meta = await getDocMeta(id);
      console.log("Loaded meta data:", meta); // Debug log
      setNotes(meta.notes || []);
      setChatHistory(meta.chat_history || []);
      setPdfUrl(getPdfUrl(id));
    } catch (err) {
      console.error("Failed to load doc data", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Upload PDF
      const res = await uploadPdf(file);
      setDocId(res.doc_id);
      setCurrentPage(1);
      
      if (res.restored) {
        console.log("Restored existing document session");
        // Force reload data if it's a restored session, 
        // in case docId didn't change (re-uploading same file)
        loadDocData(res.doc_id);
      }
      
      // No longer auto-generate summary - user will manually trigger

    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddNote = async (note) => {
    // Optimistic update
    setNotes([...notes, note]);
    try {
      await addNoteToDoc(docId, note);
    } catch (err) {
      console.error("Failed to save note", err);
      // Revert if failed (simplified)
    }
  };

  const handleRemoveNote = async (noteId) => {
    setNotes(notes.filter(n => n.id !== noteId));
    try {
      await deleteNoteFromDoc(docId, noteId);
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  const handleGenerateSummary = async () => {
    if (!docId || isGeneratingSummary) return;
    
    setIsGeneratingSummary(true);
    try {
      const response = await initDocNotes(docId, 'summary');
      if (response.cards && response.cards.length > 0) {
        setNotes(prev => [...prev, ...response.cards]);
      }
    } catch (err) {
      console.error("Failed to generate summary", err);
      alert("Failed to generate summary: " + err.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateDiagram = async () => {
    if (!docId || isGeneratingSummary) return;
    
    setIsGeneratingSummary(true);
    try {
      const response = await initDocNotes(docId, 'diagram');
      if (response.cards && response.cards.length > 0) {
        setNotes(prev => [...prev, ...response.cards]);
      }
    } catch (err) {
      console.error("Failed to generate diagram", err);
      alert("Failed to generate diagram: " + err.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!notes.length) return;
    
    let mdContent = `# Notes for Document\n\n`;
    notes.forEach(note => {
      mdContent += `## ${note.title}\n`;
      mdContent += `*Page: ${note.page}*\n\n`;
      mdContent += `${note.content}\n\n`;
      mdContent += `---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notes.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-layout">
      {/* Left Panel: Notebook */}
      <div className="notebook-panel panel-glass">
        <NotebookPanel 
          notes={notes} 
          onRemoveNote={handleRemoveNote} 
          onExportMarkdown={handleExportMarkdown}
          isGeneratingSummary={isGeneratingSummary}
          onGenerateSummary={handleGenerateSummary}
          onGenerateDiagram={handleGenerateDiagram}
          docId={docId}
        />
      </div>

      {/* Center Panel: PDF Viewer */}
      <div className="pdf-viewer-container">
        {!docId ? (
          <div className="upload-container">
            <div className="upload-box">
              {isUploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <Loader2 className="loading-spinner" size={48} color="var(--primary)" />
                  <p style={{ color: 'var(--text-main)' }}>Uploading & Analyzing...</p>
                </div>
              ) : (
                <>
                  <Upload size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Upload Research Paper</h3>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>PDF format only</p>
                  </div>
                  <label className="file-input-label">
                    Choose File
                    <input type="file" accept=".pdf" onChange={handleFileUpload} />
                  </label>
                </>
              )}
            </div>
          </div>
        ) : (
          <PDFViewer 
            file={pdfUrl} 
            pageNumber={currentPage} 
            onPageChange={setCurrentPage} 
          />
        )}
      </div>

      {/* Right Panel: Agent Console */}
      <div className="agent-panel panel-glass">
        <AgentPanel 
          docId={docId} 
          currentPage={currentPage} 
          onAddNote={handleAddNote}
          initialMessages={chatHistory}
        />
      </div>
    </div>
  );
}

export default App;
