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
