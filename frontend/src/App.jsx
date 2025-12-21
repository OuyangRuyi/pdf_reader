import React, { useState, useEffect } from 'react';
import PDFViewer from './components/PDFViewer';
import NotebookPanel from './components/NotebookPanel';
import AgentPanel from './components/AgentPanel';
import ConfigModal from './components/ConfigModal';
import ProfileModal from './components/ProfileModal';
import { uploadPdf, getDocMeta, addNoteToDoc, deleteNoteFromDoc, updateNoteInDoc, getPdfUrl, initDocNotes, getUploadedFiles, getConfigStatus, uploadAndEmbed, embedDocument, deleteDocument, skimPaper, getDocFigures } from './services/api';
import { Upload, Loader2, History, X, Settings, User, Database, CheckCircle, AlertCircle, Trash2, Image as GalleryIcon, Search, Square } from 'lucide-react';

function App() {
  const [docId, setDocId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [notes, setNotes] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [embeddingInProgress, setEmbeddingInProgress] = useState({});
  const [figures, setFigures] = useState([]);
  const [showFigures, setShowFigures] = useState(false);
  const [pendingFigureAnalysis, setPendingFigureAnalysis] = useState(null);
  const abortControllerRef = React.useRef(null);

  // ... existing code ...

  const handleLoadFigures = async () => {
    if (!docId) return;
    try {
      const figs = await getDocFigures(docId);
      setFigures(figs);
      setShowFigures(true);
    } catch (error) {
      console.error('Failed to load figures:', error);
    }
  };

  const handleFigureClick = (fig) => {
    setPendingFigureAnalysis(fig);
    setShowFigures(false);
  };

  // Resizing state
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [rightPanelWidth, setRightPanelWidth] = useState(350);
  const isResizingLeft = React.useRef(false);
  const isResizingRight = React.useRef(false);

  const startResizingLeft = (e) => {
    isResizingLeft.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startResizingRight = (e) => {
    isResizingRight.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (isResizingLeft.current) {
      const newWidth = Math.min(Math.max(200, e.clientX), 600);
      setLeftPanelWidth(newWidth);
    } else if (isResizingRight.current) {
      const newWidth = Math.min(Math.max(250, window.innerWidth - e.clientX), 600);
      setRightPanelWidth(newWidth);
    }
  };

  const stopResizing = () => {
    isResizingLeft.current = false;
    isResizingRight.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGeneratingSummary(false);
    }
  };

  // Check config status on load
  useEffect(() => {
    checkConfig();
  }, []);

  const checkConfig = async () => {
    try {
      const status = await getConfigStatus();
      setIsConfigured(status.is_configured);
      if (!status.is_configured) {
        setShowConfigModal(true);
      }
    } catch (err) {
      console.error("Failed to check config status", err);
    }
  };

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
      setFigures([]); // Clear figures when switching documents
      setShowFigures(false);
    } catch (err) {
      console.error("Failed to load doc data", err);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadResults(null);
    try {
      if (files.length === 1) {
        // Single file: Upload and open
        const res = await uploadPdf(files[0]);
        setDocId(res.doc_id);
        setCurrentPage(1);
        loadDocData(res.doc_id);
      } else {
        // Multiple files: Batch upload
        const res = await uploadAndEmbed(files);
        setUploadResults(res);
        // If we want to open the first one automatically:
        if (res.uploaded_docs && res.uploaded_docs.length > 0) {
          const firstDoc = res.uploaded_docs[0];
          setDocId(firstDoc.doc_id);
          setCurrentPage(1);
          loadDocData(firstDoc.doc_id);
        }
      }
      
      // Refresh history list
      loadHistoryFiles();
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTriggerEmbedding = async (docId) => {
    setEmbeddingInProgress(prev => ({ ...prev, [docId]: true }));
    try {
      const res = await embedDocument(docId);
      if (res.status === 'success' || res.status === 'already_completed') {
        // Refresh history to show updated status
        loadHistoryFiles();
      } else {
        alert("Embedding failed: " + res.message);
      }
    } catch (err) {
      alert("Error triggering embedding: " + err.message);
    } finally {
      setEmbeddingInProgress(prev => ({ ...prev, [docId]: false }));
    }
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm("Are you sure you want to delete this document? This will remove the PDF, all notes, chat history, and embeddings.")) {
      return;
    }

    try {
      await deleteDocument(id);
      // If the deleted doc is the current one, clear it
      if (docId === id) {
        setDocId(null);
        setPdfUrl(null);
        setNotes([]);
        setChatHistory([]);
      }
      // Refresh history
      loadHistoryFiles();
    } catch (err) {
      alert("Failed to delete document: " + err.message);
    }
  };

  const handleAddNote = async (note) => {
    if (!note) return;
    
    // Ensure note has an ID for React keys and local tracking
    const noteWithId = {
      ...note,
      id: note.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Optimistic update
    setNotes([...notes, noteWithId]);
    try {
      await addNoteToDoc(docId, noteWithId);
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

  const handleUpdateNote = async (noteId, updatedData) => {
    try {
      const noteToUpdate = notes.find(n => n.id === noteId);
      if (!noteToUpdate) return;
      
      const updatedNote = { ...noteToUpdate, ...updatedData };
      await updateNoteInDoc(docId, noteId, updatedNote);
      
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
    } catch (err) {
      console.error("Failed to update note", err);
      throw err;
    }
  };

  const handleGenerateSummary = async () => {
    if (!docId || isGeneratingSummary) return;

    setIsGeneratingSummary(true);
    abortControllerRef.current = new AbortController();
    try {
      const response = await initDocNotes(docId, 'summary', abortControllerRef.current.signal);
      if (response.cards && response.cards.length > 0) {
        setNotes(prev => [...prev, ...response.cards]);
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        console.log('Summary generation aborted');
      } else {
        console.error("Failed to generate summary", err);
        alert("Failed to generate summary: " + err.message);
      }
    } finally {
      setIsGeneratingSummary(false);
      abortControllerRef.current = null;
    }
  };

  const handleGenerateDiagram = async () => {
    if (!docId || isGeneratingSummary) return;

    setIsGeneratingSummary(true);
    abortControllerRef.current = new AbortController();
    try {
      const response = await initDocNotes(docId, 'diagram', abortControllerRef.current.signal);
      if (response.cards && response.cards.length > 0) {
        setNotes(prev => [...prev, ...response.cards]);
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        console.log('Diagram generation aborted');
      } else {
        console.error("Failed to generate diagram", err);
        alert("Failed to generate diagram: " + err.message);
      }
    } finally {
      setIsGeneratingSummary(false);
      abortControllerRef.current = null;
    }
  };

  const handleExportMarkdown = async () => {
    if (!notes.length) return;

    try {
      // Import JSZip dynamically
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      let mdContent = `# Notes for Document\n\n`;
      const imageCounter = { count: 0 };

      console.log('Processing notes:', notes.length);

      // Process each note
      for (const note of notes) {
        console.log('Processing note:', note.title);
        console.log('Note imageUrl:', note.imageUrl);

        let processedContent = note.content;

        // Handle imageUrl field (server-stored images)
        if (note.imageUrl) {
          imageCounter.count++;

          try {
            // Get image extension from URL
            const urlParts = note.imageUrl.split('.');
            const imageType = urlParts[urlParts.length - 1] || 'png';
            const filename = `image_${imageCounter.count}.${imageType}`;

            console.log(`Fetching image from: ${note.imageUrl}`);

            // Fetch image using Vite proxy (relative path)
            const imageResponse = await fetch(note.imageUrl);

            if (imageResponse.ok) {
              const imageBlob = await imageResponse.blob();
              const imageArrayBuffer = await imageBlob.arrayBuffer();
              const imageBytes = new Uint8Array(imageArrayBuffer);

              // Add image to zip
              zip.file(`images/${filename}`, imageBytes);
              console.log(`Added server image to ZIP: images/${filename}, size: ${imageBytes.length} bytes`);

              // Add image reference to markdown content
              processedContent += `\n\n![${note.title}](images/${filename})`;

            } else {
              console.error(`Failed to fetch image: ${note.imageUrl}, status: ${imageResponse.status}`);
              // Still add a placeholder reference in markdown
              processedContent += `\n\n![${note.title}](Image not available - ${note.imageUrl})`;
            }

          } catch (error) {
            console.error(`Error processing server image ${imageCounter.count}:`, error);
            // Still add a placeholder reference in markdown
            processedContent += `\n\n![${note.title}](Image not available - ${note.imageUrl})`;
          }
        }

        // Also handle base64 images in content (fallback for old data)
        const base64ImageRegex = /!\[([^\]]*)\]\(data:image\/([^;]+);base64,([^)]+)\)/g;
        const matches = [...note.content.matchAll(base64ImageRegex)];
        console.log(`Found ${matches.length} base64 images in note content: ${note.title}`);

        for (const match of matches) {
          const [fullMatch, altText, imageType, base64Data] = match;
          imageCounter.count++;

          console.log(`Processing base64 image ${imageCounter.count}: type=${imageType}, altText="${altText}"`);

          // Generate filename
          const filename = `image_${imageCounter.count}.${imageType}`;

          try {
            // Convert base64 to binary
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Add image to zip
            zip.file(`images/${filename}`, bytes);
            console.log(`Added base64 image to ZIP: images/${filename}, size: ${bytes.length} bytes`);

            // Replace base64 image with relative path in markdown
            processedContent = processedContent.replace(fullMatch, `![${altText}](images/${filename})`);

          } catch (error) {
            console.error(`Error processing base64 image ${imageCounter.count}:`, error);
          }
        }

        // Add processed content to markdown
        mdContent += `## ${note.title}\n`;
        if (note.page) {
          mdContent += `*Page: ${note.page}*\n\n`;
        }
        mdContent += `${processedContent}\n\n`;
        mdContent += `---\n\n`;
      }

      console.log('Total images found:', imageCounter.count);
      console.log('ZIP contents:', Object.keys(zip.files));

      // Add markdown file to zip
      zip.file('notes.md', mdContent);

      // Generate and download zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      console.log('Generated ZIP blob size:', zipBlob.size);

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notes.zip';
      a.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting notes:', error);

      // Fallback to simple markdown export if JSZip fails
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
    }
  };

  // 新增清除文档的函数
  const handleCloseDocument = () => {
    setDocId(null);
    setPdfUrl(null);
    setNotes([]);
    setChatHistory([]);
    setCurrentPage(1);
  };

  // 加载历史文件列表
  const loadHistoryFiles = async () => {
    setLoadingHistory(true);
    try {
      const response = await getUploadedFiles();
      setUploadedFiles(response.files || []);
    } catch (err) {
      console.error("Failed to load history files", err);
      alert("Failed to load history files: " + err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 打开历史弹窗时加载文件列表
  useEffect(() => {
    if (showHistoryModal) {
      loadHistoryFiles();
    }
  }, [showHistoryModal]);

  // 选择历史文件
  const handleSelectHistoryFile = async (docId) => {
    setShowHistoryModal(false);
    setDocId(docId);
    setCurrentPage(1);
    loadDocData(docId);
  };

  const handleAnalyzePaper = async () => {
    if (!docId) return;
    setIsGeneratingSummary(true);
    abortControllerRef.current = new AbortController();
    try {
      const analysis = await skimPaper(docId, abortControllerRef.current.signal);
      
      if (analysis.error) {
        alert(`Failed to analyze paper: ${analysis.error}`);
        return;
      }
      
      // Combine everything into ONE comprehensive note
      const analysisNote = {
        id: Date.now().toString(),
        type: 'overview',
        title: `Paper Analysis: ${uploadedFiles.find(f => f.doc_id === docId)?.title || 'Document'}`,
        content: `### 📝 Summary\n${analysis.detailed_summary}\n\n` +
                 `### 🎯 Problem\n${analysis.problem}\n\n` +
                 `### 💡 Core Innovation\n${analysis.core_idea}\n\n` +
                 `### 🛠️ Methodology\n${analysis.method_skeleton}\n\n` +
                 `### 📊 Key Results\n${analysis.main_results}\n\n` +
                 `### ⚠️ Limitations\n${analysis.limitations}\n\n` +
                 `### 🗺️ Suggested Reading Path\n${analysis.reading_path}`,
        imageUrl: null,
        page: 1,
        createdAt: new Date().toISOString()
      };
      
      await handleAddNote(analysisNote);
      
      // alert('Comprehensive analysis added to Notebook!');
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.error('Analysis failed:', error);
        alert('Failed to analyze paper.');
      }
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Left Panel: Notebook */}
      <div className="notebook-panel panel-glass" style={{ width: `${leftPanelWidth}px`, minWidth: `${leftPanelWidth}px`, maxWidth: `${leftPanelWidth}px` }}>
        <NotebookPanel
          notes={notes}
          onRemoveNote={handleRemoveNote}          onUpdateNote={handleUpdateNote}          onExportMarkdown={handleExportMarkdown}
          isGeneratingSummary={isGeneratingSummary}
          onGenerateSummary={handleGenerateSummary}
          onGenerateDiagram={handleGenerateDiagram}
          onStopGeneration={handleStopGeneration}
          onOpenConfig={() => setShowConfigModal(true)}
          onOpenProfile={() => setShowProfileModal(true)}
          docId={docId}
          onAnalyzePaper={handleAnalyzePaper}
          onShowFigures={handleLoadFigures}
          onPageChange={setCurrentPage}
          figures={figures}
          showFigures={showFigures}
          setShowFigures={setShowFigures}
          onAnalyzeFigure={handleFigureClick}
        />
      </div>

      {/* Left Resizer */}
      <div className="resizer resizer-left" onMouseDown={startResizingLeft} />

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
                    Choose File(s)
                    <input type="file" accept=".pdf" multiple onChange={handleFileUpload} />
                  </label>

                  {uploadResults && (
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '1rem', 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      width: '100%',
                      textAlign: 'left'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Upload Results</h4>
                        <button onClick={() => setUploadResults(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={14}/></button>
                      </div>
                      <div style={{ fontSize: '0.85rem', maxHeight: '150px', overflow: 'auto' }}>
                        {uploadResults.uploaded_docs?.map(doc => (
                          <div key={doc.doc_id} style={{ color: '#4ade80', marginBottom: '2px' }}>✓ {doc.title || doc.doc_id}</div>
                        ))}
                        {uploadResults.failed_files?.map(file => (
                          <div key={file.name} style={{ color: '#f87171', marginBottom: '2px' }}>✗ {file.name}: {file.reason}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 历史上传按钮 */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button
                      onClick={() => setShowHistoryModal(true)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem'
                      }}
                    >
                      <History size={16} />
                      History
                    </button>
                    <button
                      onClick={() => setShowProfileModal(true)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem'
                      }}
                    >
                      <User size={16} />
                      Personal Memory
                    </button>
                    <button
                      onClick={() => setShowConfigModal(true)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem'
                      }}
                    >
                      <Settings size={16} />
                      Settings
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <PDFViewer
              file={pdfUrl}
              pageNumber={currentPage}
              onPageChange={setCurrentPage}
            />
            {/* 添加关闭按钮 */}
            <button
              className="close-document-btn"
              onClick={handleCloseDocument}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: '#ff4d4f',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '20px', // 确保按钮宽度为 40px
                height: '20px', // 确保按钮高度为 40px
                fontSize: '16px',
                display: 'flex', // 使用 flexbox 对齐
                alignItems: 'center', // 垂直居中
                justifyContent: 'center', // 水平居中
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                padding: '0', // 确保没有额外的内边距
                margin: '0', // 确保没有额外的外边距
                lineHeight: '1', // 确保行高不会影响对齐
              }}
            >
              ✕
            </button>
          </>
        )}
      </div>

      {/* 历史文件弹窗 */}
      {showHistoryModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '900px',
              width: '95%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Files Uploaded</h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  padding: '0.25rem'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 className="loading-spinner" size={24} />
              </div>
            ) : uploadedFiles.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                No history files found
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {uploadedFiles
                  .map((file) => (
                  <div
                    key={file.doc_id}
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div 
                      onClick={() => handleSelectHistoryFile(file.doc_id)}
                      style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                    >
                      <div style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-main)', 
                        marginBottom: '0.25rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {file.title || `Document ${file.doc_id.substring(0, 8)}`}
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-dim)', 
                        display: 'flex', 
                        gap: '1rem', 
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        <span>{file.num_pages} pages</span>
                        {file.has_notes && <span>📝 Has notes</span>}
                        {file.has_chat && <span>💬 Has chat</span>}
                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                        
                        {/* Embedding Status Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                          {file.embedding_status === 'completed' ? (
                            <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <CheckCircle size={12} /> Embedded
                            </span>
                          ) : file.embedding_status === 'processing' ? (
                            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <Loader2 size={12} className="loading-spinner" /> Embedding...
                            </span>
                          ) : file.embedding_status === 'failed' ? (
                            <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <AlertCircle size={12} /> Failed
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <Database size={12} /> Not Embedded
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div style={{ marginLeft: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {file.embedding_status !== 'completed' && file.embedding_status !== 'processing' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerEmbedding(file.doc_id);
                          }}
                          disabled={embeddingInProgress[file.doc_id]}
                          style={{
                            padding: '0.4rem 0.8rem',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          {embeddingInProgress[file.doc_id] ? <Loader2 size={12} className="loading-spinner" /> : <Database size={12} />}
                          Embed
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(file.doc_id);
                        }}
                        style={{
                          padding: '0.4rem',
                          backgroundColor: 'transparent',
                          color: '#f87171',
                          border: '1px solid #f87171',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#f87171';
                          e.target.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                          e.target.style.color = '#f87171';
                        }}
                        title="Delete document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Panel: Agent Console */}
      <div className="resizer resizer-right" onMouseDown={startResizingRight} />
      <div className="agent-panel panel-glass" style={{ width: `${rightPanelWidth}px`, minWidth: `${rightPanelWidth}px`, maxWidth: `${rightPanelWidth}px` }}>
        <AgentPanel
          docId={docId}
          currentPage={currentPage}
          onAddNote={handleAddNote}
          initialMessages={chatHistory}
          currentDocMeta={uploadedFiles.find(f => f.doc_id === docId)}
          onPageChange={setCurrentPage}
          pendingFigureAnalysis={pendingFigureAnalysis}
          onFigureAnalysisComplete={() => setPendingFigureAnalysis(null)}
          figures={figures}
        />
      </div>

      {/* Config Modal */}
      <ConfigModal 
        isOpen={showConfigModal} 
        onClose={() => setShowConfigModal(false)}
        onConfigSaved={() => setIsConfigured(true)}
      />
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />    </div>
  );
}

export default App;
