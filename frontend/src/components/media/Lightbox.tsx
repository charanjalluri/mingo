import React from 'react';
import { X, Download } from 'lucide-react';

interface LightboxProps {
  src: string;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ src, onClose }) => {
  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
      >
        <img
          src={src}
          alt="Full screen media"
          style={{
            maxWidth: '100%',
            maxHeight: '90vh',
            borderRadius: 'var(--radius-md)',
            objectFit: 'contain',
            boxShadow: 'var(--shadow-lg)'
          }}
        />

        <div style={{
          position: 'absolute',
          top: '-48px',
          right: 0,
          display: 'flex',
          gap: '8px'
        }}>
          <a
            href={src}
            download="mingo_media"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Download image"
          >
            <Download size={20} />
          </a>

          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
