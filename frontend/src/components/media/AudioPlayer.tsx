import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatAudioDuration } from '../../utils/dateUtils';

interface AudioPlayerProps {
  src: string;
  duration?: number | null;
  isSelf?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, duration, isSelf }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const percent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '4px 0',
      minWidth: '180px'
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={togglePlay}
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          backgroundColor: isSelf ? '#ffffff' : 'var(--accent-primary)',
          color: isSelf ? 'var(--accent-primary)' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
      </button>

      <div style={{ flex: 1 }}>
        {/* Waveform / Progress bar */}
        <div
          onClick={(e) => {
            if (!audioRef.current || totalDuration === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const newTime = (clickX / rect.width) * totalDuration;
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }}
          style={{
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            cursor: 'pointer'
          }}
        >
          {Array.from({ length: 18 }).map((_, i) => {
            const barHeight = 6 + Math.sin(i * 0.8) * 8;
            const isActive = (i / 18) * 100 <= percent;
            return (
              <div
                key={i}
                style={{
                  width: '3px',
                  height: `${barHeight}px`,
                  borderRadius: '2px',
                  backgroundColor: isActive
                    ? (isSelf ? '#ffffff' : 'var(--accent-primary)')
                    : (isSelf ? 'rgba(255, 255, 255, 0.35)' : 'var(--text-muted)')
                }}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ fontSize: '0.7rem', color: isSelf ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-muted)' }}>
            {formatAudioDuration(currentTime)}
          </span>
          <span style={{ fontSize: '0.7rem', color: isSelf ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-muted)' }}>
            {formatAudioDuration(totalDuration)}
          </span>
        </div>
      </div>
    </div>
  );
};
