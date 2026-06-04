import React, { useState, useRef } from 'react';
import { Scissors, Trash2, ZoomIn, ZoomOut, ArrowLeft, ArrowRight, Magnet, Activity, Layers, Copy, Plus } from 'lucide-react';
import { VideoClip } from '../types';
import { formatTimecode } from '../utils/videoUtils';

interface TimelineProps {
  clips: VideoClip[];
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  onSplitClip: () => void;
  onDeleteClip: (id: string) => void;
  onDuplicateClip: (clip: VideoClip) => void;
  onUpdateClip: (id: string, updatedFields: Partial<VideoClip>) => void;
  isMagneticMode: boolean;
  setIsMagneticMode: (magnetic: boolean) => void;
  totalDuration: number;
}

export default function Timeline({
  clips,
  selectedClipId,
  setSelectedClipId,
  currentTime,
  setCurrentTime,
  onSplitClip,
  onDeleteClip,
  onDuplicateClip,
  onUpdateClip,
  isMagneticMode,
  setIsMagneticMode,
  totalDuration,
}: TimelineProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(4); // Pixels per second coefficient
  const timelineRulerRef = useRef<HTMLDivElement>(null);

  // Calculate length of the overall track space
  const pixelsPerSecond = zoomLevel * 6; // zoom coefficient mapped to width scale
  const timelineWidth = Math.max(800, totalDuration * pixelsPerSecond + 150);

  // Drag/Scrub on Ruler to seek playhead
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRulerRef.current) return;
    
    const handleDrag = (clientX: number) => {
      if (!timelineRulerRef.current) return;
      const rect = timelineRulerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickedTime = Math.max(0, Math.min(clickX / pixelsPerSecond, totalDuration));
      setCurrentTime(clickedTime);
    };

    handleDrag(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleDrag(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleRulerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!timelineRulerRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    
    const handleDrag = (clientX: number) => {
      if (!timelineRulerRef.current) return;
      const rect = timelineRulerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickedTime = Math.max(0, Math.min(clickX / pixelsPerSecond, totalDuration));
      setCurrentTime(clickedTime);
    };

    handleDrag(touch.clientX);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const moveTouch = moveEvent.touches[0];
      if (moveTouch) {
        handleDrag(moveTouch.clientX);
      }
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Safe duration of single segment
  const getClipDuration = (clip: VideoClip): number => {
    return (clip.endOffset - clip.startOffset) / clip.speed;
  };

  // Inline trim/offset adjuster
  const nudgeOffset = (clip: VideoClip, field: 'startOffset' | 'endOffset', amount: number) => {
    let newVal;
    if (field === 'startOffset') {
      newVal = Math.max(0, Math.min(clip.startOffset + amount, clip.endOffset - 0.5));
      onUpdateClip(clip.id, { startOffset: newVal });
    } else {
      newVal = Math.max(clip.startOffset + 0.5, Math.min(clip.endOffset + amount, clip.duration));
      onUpdateClip(clip.id, { endOffset: newVal });
    }
  };

  // Timeline nudge placement
  const nudgeTimelineStart = (clip: VideoClip, amount: number) => {
    if (isMagneticMode) return; // not applicable in magnetic snap flow
    const newVal = Math.max(0, clip.timelineStart + amount);
    onUpdateClip(clip.id, { timelineStart: newVal });
  };

  // Generate ticks for timeline rule
  const renderRulerTicks = () => {
    const ticks = [];
    const interval = totalDuration < 15 ? 1 : totalDuration < 60 ? 5 : totalDuration < 180 ? 10 : 30;
    
    for (let s = 0; s <= totalDuration + 10; s += interval) {
      const leftPos = s * pixelsPerSecond;
      ticks.push(
        <div 
          key={`tick-${s}`} 
          className="absolute top-0 h-full border-l border-slate-700 pointer-events-none"
          style={{ left: `${leftPos}px` }}
        >
          <span className="text-[9px] font-mono text-slate-500 pl-1 select-none">
            {formatTimecode(s)}
          </span>
        </div>
      );
    }
    return ticks;
  };

  // Identify selected clip block
  const activeClipForOperations = clips.find(c => c.id === selectedClipId);

  return (
    <div className="bg-[#0D0D0F] border border-neutral-800 rounded-lg p-4 shadow-xl flex flex-col gap-3" id="timeline-panel">
      {/* Upper action control hubs */}
      <div className="flex md:flex-row flex-col flex-wrap md:items-center justify-between gap-3 border-b border-neutral-805 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 font-sans">
          {/* Timeline header */}
          <div className="flex items-center gap-2 mr-3 select-none">
            <Layers className="text-indigo-450 shrink-0" size={15} />
            <span className="text-xs font-bold text-neutral-200 tracking-wider">SEQUENCE TRACK</span>
          </div>

          {/* Slicing Controls */}
          <button
            onClick={onSplitClip}
            disabled={clips.length === 0}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-[#121214] hover:bg-neutral-800 border border-neutral-805 rounded-sm text-xs font-semibold text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed transition focus:outline-none hover:text-indigo-400 cursor-pointer"
            title="Split Clip at Playhead (C)"
            id="btn-split-clip"
          >
            <Scissors size={13} className="text-indigo-405" />
            Cut (Split)
          </button>
          
          <button
            onClick={() => activeClipForOperations && onDeleteClip(activeClipForOperations.id)}
            disabled={!selectedClipId}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-[#121214] hover:bg-rose-950/20 border border-neutral-805 hover:border-rose-900/40 rounded-sm text-xs font-semibold text-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed transition hover:text-rose-405 cursor-pointer focus:outline-none"
            title="Delete Selected Clip"
            id="btn-delete-clip"
          >
            <Trash2 size={13} />
            Delete Block
          </button>

          <button
            onClick={() => activeClipForOperations && onDuplicateClip(activeClipForOperations)}
            disabled={!selectedClipId}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-[#121214] hover:bg-neutral-800 border border-neutral-805 rounded-sm text-xs font-semibold text-neutral-305 disabled:opacity-50 disabled:cursor-not-allowed transition hover:text-indigo-455 cursor-pointer focus:outline-none"
            title="Duplicate Selected Clip"
            id="btn-duplicate-clip"
          >
            <Copy size={13} />
            Duplicate
          </button>
        </div>

        {/* Magnetic layout and Zooming configs */}
        <div className="flex items-center gap-4">
          {/* Snap toggle modes */}
          <div className="flex items-center gap-1 bg-[#121214] p-1 border border-neutral-805 rounded">
            <button
              onClick={() => setIsMagneticMode(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-bold transition-all focus:outline-none cursor-pointer ${
                isMagneticMode 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-neutral-450 hover:text-neutral-200'
              }`}
              title="Clips snap directly next to each other"
              id="magnetic-mode-on"
            >
              <Magnet size={11} className={isMagneticMode ? 'animate-pulse text-white' : 'text-neutral-450'} />
              Magnetic
            </button>
            <button
              onClick={() => setIsMagneticMode(false)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-bold transition-all focus:outline-none cursor-pointer ${
                !isMagneticMode 
                  ? 'bg-neutral-800 text-indigo-400 border border-neutral-750' 
                  : 'text-neutral-500 hover:text-neutral-400'
              }`}
              title="Free placement timeline start offset shifts"
              id="magnetic-mode-off"
            >
              <Activity size={11} />
              Freeform
            </button>
          </div>

          <div className="flex items-center gap-1 text-neutral-450">
            <button
              onClick={() => setZoomLevel(prev => Math.max(1, prev - 1))}
              className="p-1 hover:bg-neutral-800 hover:text-indigo-400 rounded transition cursor-pointer focus:outline-none"
              title="Zoom Out"
              id="btn-zoom-out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] font-mono text-neutral-500 font-bold uppercase tracking-widest px-0.5">ZOOM</span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(10, prev + 1))}
              className="p-1 hover:bg-neutral-800 hover:text-indigo-400 rounded transition cursor-pointer focus:outline-none"
              title="Zoom In"
              id="btn-zoom-in"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main horizontally scrollable viewport wrapping Ruler and Clips */}
      <div className="relative bg-[#09090A] border border-neutral-805/80 rounded-sm overflow-x-auto min-h-[220px]" id="timeline-horizontal-scroll">
        <div style={{ width: `${timelineWidth}px` }} className="relative py-2 min-h-full">
          
          {/* 1. Timeline Ruler ticks */}
          <div 
            ref={timelineRulerRef}
            onMouseDown={handleRulerMouseDown}
            onTouchStart={handleRulerTouchStart}
            className="h-6 relative w-full border-b border-neutral-805 bg-[#09090A] cursor-pointer flex items-center select-none"
            id="timeline-timepath-ruler"
          >
            {renderRulerTicks()}
          </div>

          {/* 2. Audio/Video Track Layer */}
          <div className="relative mt-4 h-24 mb-3 timeline-grid w-full" id="tracks-wrapper">
            {clips.map((clip, idx) => {
              const startX = clip.timelineStart * pixelsPerSecond;
              const clipWidth = getClipDuration(clip) * pixelsPerSecond;
              const isSelected = selectedClipId === clip.id;

              return (
                <div
                  key={clip.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClipId(clip.id);
                  }}
                  className={`absolute h-20 rounded-md flex flex-col justify-between border-2 overflow-hidden shadow-md select-none cursor-pointer group transition-all duration-150 ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-450 text-white ring-2 ring-indigo-550/15'
                      : 'bg-[#121214] border-neutral-805 hover:border-neutral-700 hover:bg-[#121214]/90 text-neutral-300'
                  }`}
                  style={{
                    left: `${startX}px`,
                    width: `${Math.max(80, clipWidth)}px`,
                  }}
                  id={`clip-block-${clip.id}`}
                >
                  {/* Clip ID/Header header bar */}
                  <div className="bg-[#09090A]/90 px-2 py-1 flex items-center justify-between border-b border-neutral-805/45">
                    <span className="text-[10px] font-bold truncate pr-1">
                      {idx + 1}. {clip.name}
                    </span>
                    <span className="text-[9px] font-mono text-indigo-400 shrink-0 font-medium bg-[#121214]/60 px-1 py-0.5 rounded border border-neutral-805/40">
                      {getClipDuration(clip).toFixed(1)}s
                    </span>
                  </div>

                  {/* Central visual info (applied filters) */}
                  <div className="flex-1 flex flex-col justify-center px-2 py-1 relative">
                    <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-wider block">
                      FX: {clip.filter === 'none' ? 'dry' : clip.filter}
                    </span>
                    {clip.textOverlay && (
                      <span className="text-[8px] italic font-medium text-amber-400 truncate mt-0.5">
                        📝 "{clip.textOverlay}"
                      </span>
                    )}
                  </div>

                  {/* Inline trim actions toolbar only on active selection */}
                  {isSelected && (
                    <div className="bg-[#09090A]/95 py-1 px-1.5 flex items-center justify-between border-t border-neutral-805/40 gap-1">
                      {/* Left trim offsets */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            nudgeOffset(clip, 'startOffset', 0.5);
                          }}
                          className="px-1 text-[9px] font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition focus:outline-none"
                          title="Shorten beginning (+0.5s local slice)"
                        >
                          →
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            nudgeOffset(clip, 'startOffset', -0.5);
                          }}
                          className="px-1 text-[9px] font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition focus:outline-none"
                          title="Lengthen beginning (-0.5s local slice)"
                        >
                          ←
                        </button>
                      </div>

                      {/* Manual absolute positioning for free placement */}
                      {!isMagneticMode && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              nudgeTimelineStart(clip, -1);
                            }}
                            className="p-0.5 rounded text-[9px] hover:bg-neutral-800 focus:outline-none"
                            title="Shift entire clip earlier"
                          >
                            ◄
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              nudgeTimelineStart(clip, 1);
                            }}
                            className="p-0.5 rounded text-[9px] hover:bg-neutral-800 focus:outline-none"
                            title="Shift entire clip later"
                          >
                            ►
                          </button>
                        </div>
                      )}

                      {/* Right edge trim offsets */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            nudgeOffset(clip, 'endOffset', -0.5);
                          }}
                          className="px-1 text-[9px] font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition focus:outline-none"
                          title="Shorten end (-0.5s original edge)"
                        >
                          ←
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            nudgeOffset(clip, 'endOffset', 0.5);
                          }}
                          className="px-1 text-[9px] font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition focus:outline-none"
                          title="Lengthen end (+0.5s original edge)"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 3. Global Timeline Playhead indicator line */}
          <div
            className="absolute top-0 bottom-0 border-l-2 border-amber-500 z-10 pointer-events-none"
            style={{
              left: `${currentTime * pixelsPerSecond}px`,
            }}
            id="timeline-live-playhead"
          >
            {/* Playhead arrow flag */}
            <div className="absolute top-0 -left-[5px] w-[11px] h-[11px] bg-amber-500 rotate-45 transform origin-center shadow border-b border-r border-[#000000]"></div>
          </div>
        </div>
      </div>

      {/* Pro Tooltips Footnotes */}
      <div className="flex justify-between items-center text-[10px] text-neutral-500 bg-[#09090A] p-2 border border-neutral-805/50 rounded">
        <span className="flex items-center gap-1.5 leading-none">
          <span className="w-1.5 h-1.5 bg-indigo-505 rounded-full"></span>
          Select an asset block to reveal edge trim adjustment buttons (<b>← / →</b>).
        </span>
        <span className="font-mono text-[9px] text-neutral-600 leading-none">
          Max Project Bounds: {formatTimecode(totalDuration)}
        </span>
      </div>
    </div>
  );
}
