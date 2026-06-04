import React, { useState, useEffect, useMemo } from 'react';
import { Film, HelpCircle, Layers, Sparkles, Wand2, Info, FolderGit, History, Check, Play } from 'lucide-react';
import { VideoClip, ExportedVideo } from './types';
import { formatTimecode } from './utils/videoUtils';

// Modular Component imports
import MediaHub from './components/MediaHub';
import VideoPlayer from './components/VideoPlayer';
import Timeline from './components/Timeline';
import SidebarControls from './components/SidebarControls';
import ExportView from './components/ExportView';

export default function App() {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMagneticMode, setIsMagneticMode] = useState<boolean>(true);
  const [exportedVideos, setExportedVideos] = useState<ExportedVideo[]>([]);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState<boolean>(true);

  // Load exported histories from cache
  useEffect(() => {
    const saved = localStorage.getItem('web_video_editor_exports');
    if (saved) {
      try {
        setExportedVideos(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to translate local storage history', err);
      }
    }
  }, []);

  // Save exported histories to cache
  const triggerSaveExports = (updated: ExportedVideo[]) => {
    setExportedVideos(updated);
    localStorage.setItem('web_video_editor_exports', JSON.stringify(updated));
  };

  // Align clips back-to-back dynamically for magnetic timeline
  const alignMagneticClips = (rawClips: VideoClip[]): VideoClip[] => {
    let currTime = 0;
    return rawClips.map((clip) => {
      const duration = (clip.endOffset - clip.startOffset) / clip.speed;
      const aligned = { ...clip, timelineStart: currTime };
      currTime += duration;
      return aligned;
    });
  };

  // Safe wrapping state modifier for automatic alignments
  const updateClipsState = (newClips: VideoClip[]) => {
    if (isMagneticMode) {
      setClips(alignMagneticClips(newClips));
    } else {
      setClips(newClips);
    }
  };

  // Toggle magnetic track snapping mode
  const handleToggleMagnetic = (magnetic: boolean) => {
    setIsMagneticMode(magnetic);
    if (magnetic) {
      setClips(alignMagneticClips(clips));
    }
  };

  // Calculate overall timing constraints
  const totalDuration = useMemo(() => {
    if (clips.length === 0) return 10; // minimum timescale room
    const trackEnds = clips.map((clip) => {
      const clipDuration = (clip.endOffset - clip.startOffset) / clip.speed;
      return clip.timelineStart + clipDuration;
    });
    const maxEnd = Math.max(...trackEnds);
    return maxEnd > 0 ? maxEnd : 10;
  }, [clips]);

  // Insert clip operation
  const handleAddClip = (clipTemplate: Omit<VideoClip, 'id' | 'timelineStart'>) => {
    const id = `clip-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let insertPoint = 0;

    if (isMagneticMode) {
      // Find the end of last clip
      if (clips.length > 0) {
        const lastClip = clips[clips.length - 1];
        insertPoint = lastClip.timelineStart + (lastClip.endOffset - lastClip.startOffset) / lastClip.speed;
      }
    } else {
      insertPoint = currentTime;
    }

    const newClip: VideoClip = {
      ...clipTemplate,
      id,
      timelineStart: insertPoint,
    };

    const nextClipsList = [...clips, newClip];
    updateClipsState(nextClipsList);
    setSelectedClipId(id);
    
    // Auto shift cursor to start of new clip if in magnetic
    if (!isMagneticMode) {
      setCurrentTime(insertPoint);
    }
  };

  // Precise cutting / split action
  const handleSplitClip = () => {
    if (clips.length === 0) return;

    // Search active clip at playhead
    const targetIndex = clips.findIndex((clip) => {
      const duration = (clip.endOffset - clip.startOffset) / clip.speed;
      return currentTime >= clip.timelineStart && currentTime < clip.timelineStart + duration;
    });

    if (targetIndex === -1) return; // no clip sits under the current coordinate

    const clip = clips[targetIndex];
    const elapsedOnTimeline = currentTime - clip.timelineStart;
    const localSplitPoint = clip.startOffset + (elapsedOnTimeline * clip.speed);

    // Safeguard splits too close to limits
    if (localSplitPoint - clip.startOffset < 0.2 || clip.endOffset - localSplitPoint < 0.2) {
      return; // prevent microscopic slices
    }

    const leftId = `${clip.id}-left-${Date.now()}`;
    const rightId = `${clip.id}-right-${Date.now()}`;

    const leftClip: VideoClip = {
      ...clip,
      id: leftId,
      endOffset: localSplitPoint,
    };

    const rightClip: VideoClip = {
      ...clip,
      id: rightId,
      startOffset: localSplitPoint,
      timelineStart: currentTime,
    };

    // Replace original clip with left and right parts
    const nextList = [...clips];
    nextList.splice(targetIndex, 1, leftClip, rightClip);
    
    updateClipsState(nextList);
    setSelectedClipId(rightId);
    setIsPlaying(false); // pause to focus on split point
  };

  // Wipe block
  const handleDeleteClip = (id: string) => {
    const nextList = clips.filter((c) => c.id !== id);
    updateClipsState(nextList);
    if (selectedClipId === id) {
      setSelectedClipId(null);
    }
  };

  // Duplicate block
  const handleDuplicateClip = (clip: VideoClip) => {
    const id = `clip-dup-${Date.now()}`;
    let startPos = clip.timelineStart;

    if (!isMagneticMode) {
      // Offset slightly to the right to prevent overlapping stack
      startPos += (clip.endOffset - clip.startOffset) / clip.speed;
    }

    const duplicated: VideoClip = {
      ...clip,
      id,
      timelineStart: startPos,
    };

    const nextList = [...clips, duplicated];
    updateClipsState(nextList);
    setSelectedClipId(id);
  };

  // Custom visual metadata modifier merging
  const handleUpdateClip = (id: string, updatedFields: Partial<VideoClip>) => {
    const nextList = clips.map((c) => (c.id === id ? { ...c, ...updatedFields } : c));
    updateClipsState(nextList);
  };

  // Capture finished compilation results
  const handleExportComplete = (newExport: ExportedVideo) => {
    triggerSaveExports([newExport, ...exportedVideos]);
  };

  const handleDeleteExport = (id: string) => {
    const filtered = exportedVideos.filter((evt) => evt.id !== id);
    triggerSaveExports(filtered);
  };

  // Seed sample starter project structure to quickly experience the app
  const handleSeedSampleProject = () => {
    const sampleClips: VideoClip[] = [
      {
        id: 'seed-clip-1',
        name: 'Serene Nature Stream',
        blobUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        duration: 15,
        startOffset: 0,
        endOffset: 8.5,
        timelineStart: 0,
        filter: 'sepia',
        textOverlay: 'Welcome to Nature Cinematic',
        textPosition: 'bottom',
        textColor: '#facc15',
        textSize: 26,
        volume: 0.9,
        speed: 1.0,
        width: 1280,
        height: 720,
      },
      {
        id: 'seed-clip-2',
        name: 'Sintel Animated',
        blobUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        duration: 52,
        startOffset: 12.0,
        endOffset: 24.0,
        timelineStart: 8.5,
        filter: 'cool',
        textOverlay: 'Slicing Multi-Source Clips',
        textPosition: 'top',
        textColor: '#ffffff',
        textSize: 22,
        volume: 0.5,
        speed: 1.25,
        width: 1280,
        height: 720,
      },
    ];
    setClips(isMagneticMode ? alignMagneticClips(sampleClips) : sampleClips);
    setSelectedClipId('seed-clip-1');
    setCurrentTime(0);
    setShowWelcomeGuide(false);
  };

  // Register master keyboard hotkey conductors
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not interrupt when user writing in inputs/textareas
      const focusedTag = document.activeElement?.tagName;
      if (focusedTag === 'INPUT' || focusedTag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (clips.length > 0) setIsPlaying((prev) => !prev);
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        handleSplitClip();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          handleDeleteClip(selectedClipId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clips, currentTime, selectedClipId, isMagneticMode]);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-neutral-200 flex flex-col font-sans antialiased select-none selection:bg-indigo-650/40 selection:text-indigo-200">
      
      {/* 1. Header Navigation */}
      <nav className="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-[#121214] sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Film className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">V-EDIT <span className="text-indigo-400">PRO</span></span>
          </div>
          <div className="h-6 w-[1px] bg-neutral-800 hidden md:block"></div>
          <div className="hidden md:flex gap-4 text-xs font-semibold text-neutral-400 select-none">
            <span className="hover:text-white transition-colors cursor-pointer">File</span>
            <span className="hover:text-white transition-colors cursor-pointer">Edit</span>
            <span className="hover:text-white transition-colors text-indigo-400 border-b-2 border-indigo-400 pb-1">Editor</span>
            <span className="hover:text-white transition-colors cursor-pointer">Clip Controls</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-[11px] font-mono bg-neutral-900/90 px-3 py-1.5 rounded border border-neutral-800 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            PROJECT: <span className="text-indigo-400 font-bold uppercase">CINEMA_REEL_2026</span>
          </div>
          
          <button
            onClick={handleSeedSampleProject}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-500/10"
          >
            <FolderGit size={14} />
            LOAD SAMPLE
          </button>
        </div>
      </nav>

      {/* 2. Main Studio Workbench Layout */}
      <main className="flex-1 p-5 grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch max-w-[1700px] w-full mx-auto bg-[#050505]">
        
        {/* Left Side elements: Media Hub Explorer (cols = 4) */}
        <div className="xl:col-span-4 flex flex-col h-full min-h-[450px]">
          <MediaHub
            onAddClip={handleAddClip}
            exportedVideos={exportedVideos}
            onDeleteExport={handleDeleteExport}
          />
        </div>

        {/* Center / Right Side elements: Video Player Preview (cols = 5) */}
        <div className="xl:col-span-5 flex flex-col h-full min-h-[420px]">
          <VideoPlayer
            clips={clips}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            totalDuration={totalDuration}
          />
        </div>

        {/* Rightmost elements: Clip Inspector controls & Export settings (cols = 3) */}
        <div className="xl:col-span-3 flex flex-col gap-5">
          {/* Clip Inspector panel */}
          <div className="flex-1 min-h-[300px]">
            <SidebarControls
              selectedClipId={selectedClipId}
              clips={clips}
              onUpdateClip={handleUpdateClip}
            />
          </div>

          {/* Compilation Compiler panel */}
          <div className="min-h-[220px]">
            <ExportView
              clips={clips}
              totalDuration={totalDuration}
              onExportComplete={handleExportComplete}
            />
          </div>
        </div>

        {/* Bottom Sequence Track Timeline (cols = 12) */}
        <div className="xl:col-span-12">
          <Timeline
            clips={clips}
            selectedClipId={selectedClipId}
            setSelectedClipId={setSelectedClipId}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            onSplitClip={handleSplitClip}
            onDeleteClip={handleDeleteClip}
            onDuplicateClip={handleDuplicateClip}
            onUpdateClip={handleUpdateClip}
            isMagneticMode={isMagneticMode}
            setIsMagneticMode={handleToggleMagnetic}
            totalDuration={totalDuration}
          />
        </div>
      </main>

      {/* 3. Global Hotkeys Footer Guide */}
      <footer className="border-t border-neutral-800 bg-[#121214] px-4 py-2.5 text-center text-[10px] text-neutral-500 font-medium">
        <div className="max-w-[800px] mx-auto flex flex-wrap justify-center gap-x-5 gap-y-1">
          <span>⌨️ Keyboard Shortcuts:</span>
          <span><kbd className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-400 font-mono">Space</kbd> Play / Pause</span>
          <span><kbd className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-400 font-mono">C</kbd> Cut / Split</span>
          <span><kbd className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-400 font-mono">Del</kbd> Delete block</span>
        </div>
      </footer>
    </div>
  );
}
