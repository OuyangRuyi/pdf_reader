import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { X, Edit2, Save, Check } from 'lucide-react';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import './FullscreenModal.css';

const FullscreenModal = ({ isOpen, onClose, title, content, images = [], onSave, isEditable = true }) => {
  const [zoomedImage, setZoomedImage] = React.useState(null);
  const [zoomScale, setZoomScale] = React.useState(1);
  const [zoomPosition, setZoomPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);

  // Reset editing state when modal opens/closes or content changes
  useEffect(() => {
    if (isOpen) {
      setEditedTitle(title);
      setEditedContent(content);
      setIsEditing(false);
    }
  }, [isOpen, title, content]);

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave({ title: editedTitle, content: editedContent });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        if (zoomedImage) {
          setZoomedImage(null);
        } else {
          onClose();
        }
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc, false);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc, false);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, zoomedImage]);

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      if (zoomedImage) {
        setZoomedImage(null);
      } else {
        onClose();
      }
    }
  };

  // Extract images from markdown content
  const extractImagesFromMarkdown = (markdownContent) => {
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const matches = [];
    let match;
    
    while ((match = imageRegex.exec(markdownContent)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  };

  // Get all images (from images prop and markdown content)
  const markdownImages = content ? extractImagesFromMarkdown(content) : [];
  const allImages = [...markdownImages, ...(images || [])];

  return createPortal(
    <div 
      className="fullscreen-modal-overlay" 
      onClick={handleBackdropClick}
      role="dialog" 
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div className="fullscreen-modal-container">
        <div className="fullscreen-modal-header">
          {title && !isEditing && <h2 id="modal-title" className="modal-title">{title}</h2>}
          {isEditing && <h2 id="modal-title" className="modal-title">Editing Note</h2>}
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
            {isEditable && onSave && !isEditing && (
              <button 
                className="modal-edit-btn"
                onClick={() => setIsEditing(true)}
                title="Edit note"
              >
                <Edit2 size={16} />
                <span>Edit</span>
              </button>
            )}
            {isEditing && (
              <>
                <button 
                  className="modal-save-btn"
                  onClick={handleSave}
                  disabled={isSaving}
                  title="Save changes"
                >
                  {isSaving ? <span className="loading-spinner-small" /> : <Save size={16} />}
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
                <button 
                  className="modal-edit-btn"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  title="Cancel editing"
                >
                  <X size={16} />
                  <span>Cancel</span>
                </button>
              </>
            )}
            <button 
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="fullscreen-modal-content">
          <div className="modal-body">
          {/* 标题区域 */}
          {isEditing ? (
            <input 
              className="modal-edit-input"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder="Note Title"
            />
          ) : (
            title && (
              <h2 className="modal-title-text">
                {title}
              </h2>
            )
          )}
          
          {/* 正文区域：纯文字，左对齐 */}
          {isEditing ? (
            <textarea 
              className="modal-edit-textarea"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="Note Content (Markdown supported)"
            />
          ) : (
            content && (
              <div className="modal-text">
                <ReactMarkdown
                  components={{
                    img: ({ src, alt }) => (
                      // 图片从文本流中抽出，放到独立的居中容器
                      <div className="modal-image-wrapper">
                        <img 
                          src={src} 
                          alt={alt || 'Image'} 
                          className="modal-image"
                          onClick={() => setZoomedImage(src)}
                          onError={(e) => {
                            console.log('Image load error:', e.target.src);
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )
          )}
          
          {/* 附加图片区域 */}
          {images && images.length > 0 && (
            <>
              {/* 分割线 */}
              <div className="modal-divider" />
              
              {/* "Attached Images" 标题居中 */}
              <h3 className="modal-images-title">
                Attached Images
              </h3>
              
              {/* 每个图片都有独立的居中容器 */}
              {images.map((imageUrl, index) => (
                <div key={index} className="modal-image-wrapper">
                  <img 
                    src={imageUrl} 
                    alt={`Attachment ${index + 1}`}
                    className="modal-image"
                    onClick={() => setZoomedImage(imageUrl)}
                    onError={(e) => {
                      console.log('Image load error:', e.target.src);
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </>
          )}
          
          {!content && (!images || images.length === 0) && (
            <div className="modal-empty-state">
              <p>No content to display</p>
            </div>
          )}
          </div>
        </div>
      </div>
      
      {/* Custom Image Zoom Overlay */}
      {zoomedImage && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(9, 9, 11, 0.95)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000000,
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setZoomedImage(null);
              setZoomScale(1);
              setZoomPosition({ x: 0, y: 0 });
            }
          }}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.5, Math.min(5, zoomScale * delta));
            setZoomScale(newScale);
          }}
        >
          <img 
            src={zoomedImage}
            alt="Zoomed"
            style={{
              maxWidth: zoomScale <= 1 ? '90vw' : 'none',
              maxHeight: zoomScale <= 1 ? '90vh' : 'none',
              width: zoomScale > 1 ? `${90 * zoomScale}vw` : 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              transform: `translate(${zoomPosition.x}px, ${zoomPosition.y}px) scale(${zoomScale > 1 ? 1 : zoomScale})`,
              cursor: isDragging ? 'grabbing' : (zoomScale > 1 ? 'grab' : 'zoom-in'),
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              userSelect: 'none'
            }}
            onMouseDown={(e) => {
              if (zoomScale > 1) {
                setIsDragging(true);
                setDragStart({ x: e.clientX - zoomPosition.x, y: e.clientY - zoomPosition.y });
              }
            }}
            onMouseMove={(e) => {
              if (isDragging && zoomScale > 1) {
                setZoomPosition({
                  x: e.clientX - dragStart.x,
                  y: e.clientY - dragStart.y
                });
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onClick={(e) => {
              e.stopPropagation();
              if (zoomScale <= 1) {
                setZoomScale(2);
              } else {
                setZoomedImage(null);
                setZoomScale(1);
                setZoomPosition({ x: 0, y: 0 });
              }
            }}
            onDragStart={(e) => e.preventDefault()}
          />
          
          {/* Zoom controls */}
          <div style={{
            position: 'absolute',
            top: '2rem',
            right: '2rem',
            display: 'flex',
            gap: '0.5rem',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            padding: '0.5rem'
          }}>
            <button
              onClick={() => setZoomScale(Math.max(0.5, zoomScale * 0.8))}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              −
            </button>
            <span style={{ color: 'white', padding: '0.5rem', minWidth: '3rem', textAlign: 'center' }}>
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(Math.min(5, zoomScale * 1.25))}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              +
            </button>
            <button
              onClick={() => {
                setZoomedImage(null);
                setZoomScale(1);
                setZoomPosition({ x: 0, y: 0 });
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
                marginLeft: '0.5rem'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default FullscreenModal;