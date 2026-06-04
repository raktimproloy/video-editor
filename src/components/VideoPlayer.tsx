import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, SkipBack, SkipForward, FlameKindling, Info, Sparkles } from 'lucide-react';
import { VideoClip } from '../types';
import { formatTimecode, applyCanvasFilter } from '../utils/videoUtils';

interface VideoPlayerProps {
  clips: VideoClip[];
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  totalDuration: number;
}

export default function VideoPlayer({
  clips,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  totalDuration,
}: VideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Keep track of animation loop and time anchoring
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Initialize hidden video element
  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = isMuted;
    video.volume = volume;
    
    // Core event handlers for smoother states
    video.onwaiting = () => setIsBuffering(true);
    video.onplaying = () => setIsBuffering(false);
    video.onseeked = () => setIsBuffering(false);

    videoRef.current = video;

    return () => {
      video.pause();
      videoRef.current = null;
    };
  }, []);

  // Sync mute and volume values to the video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume]);

  // Find the clip playing at current global timeline time
  const findActiveClipAtTime = (time: number): VideoClip | null => {
    return clips.find(
      (clip) =>
        time >= clip.timelineStart &&
        time <= clip.timelineStart + (clip.endOffset - clip.startOffset) / clip.speed
    ) || null;
  };

  const activeClip = findActiveClipAtTime(currentTime);

  // Synchronize source URL and track offset when playhead moves or clips swap
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!activeClip) {
      // No clip active at this section of the timeline
      if (!video.paused) video.pause();
      setActiveClipId(null);
      return;
    }

    // Calculate local seek time in original source video
    // LocalTime = StartOffset + (ElapsedTime * Speed)
    const elapsedOnTimeline = currentTime - activeClip.timelineStart;
    const expectedLocalTime = activeClip.startOffset + (elapsedOnTimeline * activeClip.speed);

    // If active clip changed, check if we actually need to change the video source URL
    const targetSrc = activeClip.blobUrl;
    const isSameSrc = video.src === targetSrc || video.src.endsWith(targetSrc) || encodeURI(video.src) === encodeURI(targetSrc);

    if (activeClip.id !== activeClipId) {
      setActiveClipId(activeClip.id);
      
      if (!isSameSrc) {
        video.src = targetSrc;
        video.load();
      }
      
      video.currentTime = expectedLocalTime;
      
      // Update clip-specific volume
      video.volume = volume * activeClip.volume;
      video.playbackRate = activeClip.speed;

      if (isPlaying) {
        video.play().catch(() => {});
      }
    } else {
      // Same clip, check if time drift is too high
      const drift = Math.abs(video.currentTime - expectedLocalTime);
      if (drift > 0.15) {
        video.currentTime = expectedLocalTime;
      }

      // Sync playback rate and specific volumes
      if (video.playbackRate !== activeClip.speed) {
        video.playbackRate = activeClip.speed;
      }
      const activeVol = volume * activeClip.volume;
      if (video.volume !== activeVol) {
        video.volume = activeVol;
      }

      // Sync play/pause states
      if (isPlaying && video.paused && !isBuffering) {
        video.play().catch(() => {});
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    }
  }, [currentTime, activeClipId, activeClip, isPlaying, clips]);

  // Main canvas rendering and timing animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderFrame = (timestamp: number) => {
      // 1. Time Progression logic if playing
      if (isPlaying) {
        if (lastTimeRef.current !== null) {
          const delta = (timestamp - lastTimeRef.current) / 1000;
          setCurrentTime((prev) => {
            const next = prev + delta;
            if (next >= totalDuration) {
              setIsPlaying(false);
              return 0; // wrap around
            }
            return next;
          });
        }
        lastTimeRef.current = timestamp;
      } else {
        lastTimeRef.current = null;
      }

      // 2. Painting Frame onto Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const video = videoRef.current;
      if (activeClip && video && video.readyState >= 2) {
        ctx.save();
        
        // Apply active visual clip filters
        applyCanvasFilter(ctx, activeClip.filter);
        
        // Draw the current video frame resized to standard canvas scale
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        ctx.restore();

        // Render Text Overlay if text exists and fits
        if (activeClip.textOverlay && activeClip.textOverlay.trim()) {
          ctx.save();
          const size = activeClip.textSize || 24;
          
          // Set fonts
          ctx.font = `bold ${size}px "Inter", sans-serif`;
          ctx.fillStyle = activeClip.textColor || '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const text = activeClip.textOverlay;
          const x = canvas.width / 2;
          let y = canvas.height - 60; // bottom margin

          if (activeClip.textPosition === 'top') {
            y = 60;
          } else if (activeClip.textPosition === 'middle') {
            y = canvas.height / 2;
          }

          // Draw translucent text background for high legibility
          const textWidth = ctx.measureText(text).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.65)'; // Slate background
          ctx.beginPath();
          ctx.roundRect(x - textWidth / 2 - 12, y - size / 2 - 6, textWidth + 24, size + 12, 6);
          ctx.fill();

          // Render foreground text & dark border outline
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(2, size / 10);
          ctx.strokeText(text, x, y);

          ctx.fillStyle = activeClip.textColor || '#ffffff';
          ctx.fillText(text, x, y);
          ctx.restore();
        }
      } else {
        // Draw a neat offline backdrop
        ctx.fillStyle = '#0b0f19'; // Rich dark slate
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid accents of empty projector
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 40) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, canvas.height);
          ctx.stroke();
        }
        for (let j = 0; j < canvas.height; j += 40) {
          ctx.beginPath();
          ctx.moveTo(0, j);
          ctx.lineTo(canvas.width, j);
          ctx.stroke();
        }

        // Center typography and state descriptor
        ctx.font = '500 14px "Inter", sans-serif';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        
        if (clips.length === 0) {
          ctx.fillText('No clips in timeline. Please upload a video or click Stock Library.', canvas.width / 2, canvas.height / 2);
        } else if (isBuffering) {
          ctx.fillText('Buffering and loading local video buffer...', canvas.width / 2, canvas.height / 2);
        } else {
          ctx.fillText('Ready at Empty Frame Sequence', canvas.width / 2, canvas.height / 2);
        }
      }

      // Draw subtle timeline overlay on player corner
      ctx.save();
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'left';
      ctx.fillText(formatTimecode(currentTime), 12, 24);
      ctx.restore();

      requestRef.current = requestAnimationFrame(renderFrame);
    };

    requestRef.current = requestAnimationFrame(renderFrame);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, activeClip, clips, currentTime, totalDuration, isBuffering, volume, isMuted]);

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentTime((prev) => Math.min(prev + 0.1, totalDuration));
  };

  const handleStepBackward = () => {
    setIsPlaying(false);
    setCurrentTime((prev) => Math.max(prev - 0.1, 0));
  };

  const togglePlay = () => {
    if (clips.length === 0) return;
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = (clips[0]?.startOffset || 0);
    }
  };

  return (
    <div className="flex flex-col bg-[#0D0D0F] border border-neutral-800 rounded-lg p-4 shadow-2xl overflow-hidden h-full" id="player-container">
      {/* Aspect Ratio Screen Frame */}
      <div className="relative aspect-video w-full max-w-full bg-[#050505] rounded-md overflow-hidden group border border-neutral-805 leading-none">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-contain"
          id="editor-canvas-preview"
        />

        {/* Buffering Indicator Ring Overlay */}
        {isBuffering && (
          <div className="absolute inset-0 bg-[#0A0A0B]/60 backdrop-blur-[1.5px] flex items-center justify-center gap-2">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-neutral-300 font-mono tracking-wider">LOADING STREAM</span>
          </div>
        )}

        {/* Empty timeline overlay guide */}
        {clips.length === 0 && (
          <div className="absolute top-4 right-4 bg-[#121214]/90 border border-neutral-800 p-2.5 rounded shadow-lg animate-pulse max-w-[245px]">
            <h4 className="text-[11px] font-bold text-indigo-400 flex items-center gap-1 uppercase tracking-wider">
              <Sparkles size={11} /> Start Project
            </h4>
            <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
              Select one of the stock demo clips below to instantly test scissors splitting, layout shifts & visual filter overrides!
            </p>
          </div>
        )}
      </div>

      {/* Media Controller Buttons Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        {/* Playhead status code */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-xs font-bold text-neutral-100 bg-[#121214] border border-neutral-805 px-3 py-1.5 rounded min-w-[76px] text-center">
            {formatTimecode(currentTime)}
          </span>
          <span className="text-neutral-600 text-xs">/</span>
          <span className="text-xs text-neutral-450 bg-[#121214]/40 border border-neutral-805/40 px-2 py-1 rounded">
            {formatTimecode(totalDuration)}
          </span>
        </div>

        {/* Dynamic central player controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleReset}
            className="p-2 text-neutral-400 hover:text-indigo-400 hover:bg-[#121214] rounded transition"
            title="Reset to frame zero"
            id="btn-player-reset"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={handleStepBackward}
            className="p-2 text-neutral-400 hover:text-indigo-400 hover:bg-[#121214] rounded transition"
            title="Step Back 0.1s"
            id="btn-player-step-back"
          >
            <SkipBack size={15} />
          </button>
          
          <button
            onClick={togglePlay}
            disabled={clips.length === 0}
            className={`mx-1.5 p-3 rounded-full flex items-center justify-center text-white cursor-pointer select-none transition-transform duration-100 hover:scale-105 active:scale-95 ${
              clips.length === 0
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none'
                : isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
                : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
            }`}
            title={isPlaying ? 'Pause Timeline' : 'Play Timeline'}
            id="btn-player-playtoggle"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="translate-x-[1px]" />}
          </button>

          <button
            onClick={handleStepForward}
            className="p-2 text-neutral-400 hover:text-indigo-400 hover:bg-[#121214] rounded transition"
            title="Step Forward 0.1s"
            id="btn-player-step-forward"
          >
            <SkipForward size={15} />
          </button>
        </div>

        {/* Master level audio controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 text-neutral-400 hover:text-indigo-400 hover:bg-[#121214] rounded transition"
            title={isMuted ? 'Unmute master volume' : 'Mute master volume'}
            id="btn-player-mute"
          >
            {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-16 accent-indigo-500 h-1 bg-neutral-800 rounded cursor-pointer appearance-none"
            title="Master Gain Level"
            id="player-volume-slider"
          />
        </div>
      </div>
    </div>
  );
}
