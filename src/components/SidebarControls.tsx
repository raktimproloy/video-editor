import React from 'react';
import { Type, Sliders, Palette, Gauge, Volume1, Info, Sparkles, Wand2 } from 'lucide-react';
import { VideoClip } from '../types';

interface SidebarControlsProps {
  selectedClipId: string | null;
  clips: VideoClip[];
  onUpdateClip: (id: string, updatedFields: Partial<VideoClip>) => void;
}

export default function SidebarControls({
  selectedClipId,
  clips,
  onUpdateClip,
}: SidebarControlsProps) {
  const activeClip = clips.find((c) => c.id === selectedClipId);

  const filtersList: { value: VideoClip['filter']; label: string; preview: string }[] = [
    { value: 'none', label: 'Original', preview: 'bg-slate-800' },
    { value: 'grayscale', label: 'Noir/B&W', preview: 'bg-slate-700 grayscale' },
    { value: 'sepia', label: 'Warm Sepia', preview: 'bg-amber-900/50 sepia' },
    { value: 'vintage', label: 'Retro Vintage', preview: 'bg-yellow-950/40 opacity-90' },
    { value: 'warm', label: 'Sunset Warm', preview: 'bg-red-950/20 sat-120' },
    { value: 'cool', label: 'Nordic Cool', preview: 'bg-cyan-950/20 saturate-90' },
    { value: 'highcontrast', label: 'High Contrast', preview: 'bg-sky-950/40 contrast-125' },
    { value: 'invert', label: 'X-Ray Invert', preview: 'bg-slate-500 invert' },
  ];

  const colors = [
    { value: '#ffffff', label: 'White' },
    { value: '#facc15', label: 'Amber/Yellow' },
    { value: '#22c55e', label: 'Emerald' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#ef4444', label: 'Crimson' },
    { value: '#a855f7', label: 'Violet' },
  ];

  return (
    <div className="bg-[#0D0D0F] border border-neutral-800 rounded-lg overflow-hidden shadow-xl h-full flex flex-col" id="sidebar-controls-container">
      {/* Sidebar Header */}
      <div className="bg-[#09090A] px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <h3 className="text-xs font-bold text-neutral-200 tracking-wider flex items-center gap-2">
          <Sliders size={14} className="text-indigo-400" />
          CLIP INSPECTOR
        </h3>
        {activeClip && (
          <span className="text-[10px] font-bold bg-indigo-500/10 border border-indigo-550/20 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Selected
          </span>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {!activeClip ? (
          /* Empty Inspector State */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 min-h-[300px]">
            <div className="w-12 h-12 bg-[#121214] border border-neutral-850 rounded-full flex items-center justify-center text-neutral-450 mb-3 shadow">
              <Wand2 size={20} className="text-indigo-400/80 animate-pulse" />
            </div>
            <p className="text-xs font-bold text-neutral-300 uppercase tracking-wide">No segment selected</p>
            <p className="text-[11px] text-neutral-500 mt-1.5 max-w-[200px] leading-relaxed">
              Click any colored video block on your timeline below to configure overlay captions, visual effects filters, track speeds, and audio gains.
            </p>
          </div>
        ) : (
          /* Real-time configuration panel options */
          <div className="space-y-4" id="inspector-action-panel">
            {/* 1. Visual Filters FX */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wand2 size={12} className="text-emerald-400" />
                Visual Grading Filters
              </label>
              <div className="grid grid-cols-2 gap-1.5" id="filters-grid">
                {filtersList.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => onUpdateClip(activeClip.id, { filter: filter.value })}
                    className={`p-2 rounded-sm text-left border flex flex-col justify-between transition cursor-pointer focus:outline-none ${
                      activeClip.filter === filter.value
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                        : 'bg-[#121214] border-neutral-805 hover:border-neutral-700 hover:bg-[#121214] text-neutral-300'
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{filter.label}</span>
                    <div className={`w-full h-1.5 rounded-sm mt-1.5 ${filter.preview}`}></div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Text Subtitle Overlay Option */}
            <div className="space-y-3.5 border-t border-neutral-805/85 pt-4">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Type size={12} className="text-indigo-400" />
                Overlay Text Caption
              </label>
              <input
                type="text"
                value={activeClip.textOverlay || ''}
                onChange={(e) => onUpdateClip(activeClip.id, { textOverlay: e.target.value })}
                placeholder="Type caption overlay text..."
                className="w-full bg-[#121214] border border-neutral-805 focus:border-indigo-400 rounded-sm px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700 font-medium transition"
                id="text-caption-input"
              />

              {activeClip.textOverlay && (
                <div className="space-y-3 bg-[#09090A] p-3 rounded border border-neutral-805">
                  {/* Position */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase">Position</span>
                    <div className="flex gap-1">
                      {(['top', 'middle', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => onUpdateClip(activeClip.id, { textPosition: pos })}
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold cursor-pointer capitalize focus:outline-none ${
                            activeClip.textPosition === pos
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-450'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Color */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase">Color</span>
                    <div className="flex gap-1.5">
                      {colors.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => onUpdateClip(activeClip.id, { textColor: c.value })}
                          className={`w-4 h-4 rounded-full border cursor-pointer transition focus:outline-none ${
                            activeClip.textColor === c.value
                              ? 'border-indigo-400 scale-125 ring-1 ring-indigo-505'
                              : 'border-transparent hover:scale-110'
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Font Size slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-neutral-500">
                      <span className="uppercase">Text Size</span>
                      <span className="font-mono text-indigo-450">{activeClip.textSize || 24}px</span>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="60"
                      step="2"
                      value={activeClip.textSize || 24}
                      onChange={(e) => onUpdateClip(activeClip.id, { textSize: parseInt(e.target.value) })}
                      className="w-full accent-indigo-505 h-1 bg-neutral-850 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Audio Level Gain */}
            <div className="space-y-2 border-t border-neutral-805/85 pt-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5">
                  <Volume1 size={12} className="text-sky-400" />
                  Clip Volume Gain
                </span>
                <span className="font-mono text-sky-400">{Math.round((activeClip.volume || 1.0) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={activeClip.volume || 1.0}
                onChange={(e) => onUpdateClip(activeClip.id, { volume: parseFloat(e.target.value) })}
                className="w-full accent-sky-450 h-1 bg-[#121214] border border-neutral-805 rounded cursor-pointer"
                id="clip-gain-slider"
              />
            </div>

            {/* 4. Playback Speed Multiplier */}
            <div className="space-y-2.5 border-t border-neutral-805/85 pt-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5">
                  <Gauge size={12} className="text-amber-400" />
                  Playback Speed
                </span>
                <span className="font-mono text-amber-400">{activeClip.speed || 1.0}x</span>
              </div>
              
              <div className="flex justify-between gap-1 bg-[#121214] p-1 border border-neutral-805 rounded">
                {([0.5, 1.0, 1.25, 1.5, 2.0] as const).map((speedVal) => (
                  <button
                    key={speedVal}
                    onClick={() => onUpdateClip(activeClip.id, { speed: speedVal })}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold rounded cursor-pointer transition focus:outline-none ${
                      activeClip.speed === speedVal
                        ? 'bg-amber-600 text-white font-black hover:bg-amber-500'
                        : 'text-neutral-450 hover:text-neutral-200 hover:bg-[#0D0D0F]/45'
                    }`}
                  >
                    {speedVal}x
                  </button>
                ))}
              </div>
            </div>

            {/* Info help panel */}
            <div className="text-[10.5px] text-neutral-500 leading-normal p-3 rounded bg-[#121214] border border-neutral-805/60 flex gap-2">
              <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-neutral-400 block mb-0.5">Non-Destructive Slices</span>
                Splitting or trimming doesn't alter the source file. It changes bounding offsets on the canvas player safely.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
