import React, { useState, useRef, useEffect } from 'react';
import { Smile, Paperclip, Mic, Send, X, Check, StopCircle } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { uploadsApi } from '../../api/uploads';
import { formatAudioDuration } from '../../utils/dateUtils';

interface ChatComposerProps {
  onSendMessage: (data: { content?: string; message_type?: 'text' | 'image' | 'voice'; media_url?: string; media_duration?: number }) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({ onSendMessage, onTyping }) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording
  } = useVoiceRecorder();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (isSubmitting) return;

    if (selectedFile) {
      try {
        setIsSubmitting(true);
        const uploadRes = await uploadsApi.uploadImage(selectedFile);
        await onSendMessage({
          content: text.trim() || undefined,
          message_type: 'image',
          media_url: uploadRes.url
        });
        setText('');
        clearFile();
      } catch (err) {
        alert('Failed to upload image');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (text.trim()) {
      try {
        setIsSubmitting(true);
        await onSendMessage({ content: text.trim(), message_type: 'text' });
        setText('');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSendVoice = async () => {
    try {
      setIsSubmitting(true);
      const durationSec = recordingTime;
      const blob = await stopRecording();
      if (!blob) return;

      const uploadRes = await uploadsApi.uploadVoice(blob, durationSec);
      await onSendMessage({
        message_type: 'voice',
        media_url: uploadRes.url,
        media_duration: durationSec
      });
    } catch (err) {
      alert('Failed to upload voice recording');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: 'var(--bg-card)',
      borderTop: '1px solid var(--border-subtle)',
      position: 'relative',
      zIndex: 20
    }}>
      {showEmoji && (
        <EmojiPicker onSelect={(emoji) => {
          setText((prev) => prev + emoji);
          setShowEmoji(false);
        }} />
      )}

      {/* Selected Image Preview Header */}
      {filePreviewUrl && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 12px',
          marginBottom: '8px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-input)',
          width: 'fit-content'
        }}>
          <img src={filePreviewUrl} alt="Preview" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {selectedFile?.name}
          </span>
          <button onClick={clearFile} className="interactive-btn" style={{ color: 'var(--text-muted)', padding: '4px', borderRadius: '50%' }} title="Remove file">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Recording Mode Input Bar */}
      {isRecording ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          animation: 'fadeIn 0.15s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              animation: 'pulseGlow 1s infinite ease-in-out'
            }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ef4444' }}>
              Recording... {formatAudioDuration(recordingTime)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={cancelRecording}
              className="interactive-btn press-scale-sm"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSendVoice}
              disabled={isSubmitting}
              className="press-scale-sm"
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Send size={14} /> Send Voice
            </button>
          </div>
        </div>
      ) : (
        /* Normal Typing Input Bar */
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => setShowEmoji((prev) => !prev)}
            className="interactive-btn press-scale-sm"
            style={{ padding: '10px', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', flexShrink: 0 }}
            title="Emoji picker"
          >
            <Smile size={22} />
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="interactive-btn press-scale-sm"
            style={{ padding: '10px', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', flexShrink: 0 }}
            title="Attach image"
          >
            <Paperclip size={22} />
          </button>

          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Write a message..."
              rows={1}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.93rem',
                resize: 'none',
                maxHeight: '120px',
                lineHeight: 1.45
              }}
            />
          </div>

          {text.trim() || selectedFile ? (
            <button
              onClick={handleSend}
              disabled={isSubmitting}
              className="press-scale-sm"
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: 'var(--shadow-sm)'
              }}
              title="Send Message"
            >
              <Send size={20} />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="interactive-btn press-scale-sm"
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              title="Record Voice Note"
            >
              <Mic size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
