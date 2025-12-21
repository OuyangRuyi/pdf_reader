import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const PDFViewer = ({ file, pageNumber, onPageChange }) => {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-canvas-wrapper">
        {file ? (
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div style={{color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                Loading PDF...
              </div>
            }
            error={<div style={{color: '#ef4444'}}>Failed to load PDF.</div>}
          >
            <div className="pdf-page-container">
              <Page 
                pageNumber={pageNumber} 
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="pdf-page"
                width={600} // Base width, scaled by scale prop
              />
            </div>
          </Document>
        ) : (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center' }}>
            <p>No PDF loaded</p>
          </div>
        )}
      </div>

      {file && (
        <div className="floating-toolbar">
          <button 
            className="icon-btn" 
            onClick={() => onPageChange(Math.max(1, pageNumber - 1))} 
            disabled={pageNumber <= 1}
            title="Previous Page"
          >
            <ChevronLeft size={20} />
          </button>
          
          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', minWidth: '80px', textAlign: 'center' }}>
            {pageNumber} / {numPages || '--'}
          </span>
          
          <button 
            className="icon-btn" 
            onClick={() => onPageChange(Math.min(numPages || 1, pageNumber + 1))} 
            disabled={pageNumber >= numPages}
            title="Next Page"
          >
            <ChevronRight size={20} />
          </button>
          
          <div className="toolbar-divider"></div>
          
          <button className="icon-btn" onClick={() => setScale(s => Math.max(0.5, s - 0.1))} title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '40px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          
          <button className="icon-btn" onClick={() => setScale(s => Math.min(2.0, s + 0.1))} title="Zoom In">
            <ZoomIn size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;
