import React, { useState, useRef } from 'react';
import { Upload, Plus, Film, Trash2, Download, Clock, History, CloudLightning, Music, Image as ImageIcon } from 'lucide-react';
import { VideoClip, ExportedVideo } from '../types';
import { SAMPLE_VIDEOS, getVideoMetadata, formatTimecode } from '../utils/videoUtils';

interface MediaHubProps {
  onAddClip: (clip: Omit<VideoClip, 'id' | 'timelineStart'>) => void;
  exportedVideos: ExportedVideo[];
  onDeleteExport: (id: string) => void;
}

export default function MediaHub({ onAddClip, exportedVideos, onDeleteExport }: MediaHubProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'samples' | 'exports'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processVideoFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setErrorMsg('Please upload a valid video file (MP4, WebM, QuickTime).');
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setErrorMsg(null);
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary credentials are not configured in .env');
      }

      // Read timeline metadata locally
      const meta = await getVideoMetadata(file);

      // Upload directly to Cloudinary
      const cloudinaryUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response.secure_url);
          } else {
            reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload.'));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        xhr.send(formData);
      });

      onAddClip({
        name: file.name,
        blobUrl: cloudinaryUrl,
        file: file,
        duration: meta.duration,
        startOffset: 0,
        endOffset: meta.duration,
        filter: 'none',
        textColor: '#ffffff',
        textSize: 24,
        textPosition: 'bottom',
        volume: 1.0,
        speed: 1.0,
        width: meta.width,
        height: meta.height,
      });
      
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error processing your video file.');
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processVideoFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processVideoFile(e.target.files[0]);
    }
  };

  const loadSampleVideo = (sample: typeof SAMPLE_VIDEOS[0]) => {
    onAddClip({
      name: sample.name,
      blobUrl: sample.url,
      duration: sample.duration,
      startOffset: 0,
      endOffset: sample.duration,
      filter: 'none',
      textColor: '#ffffff',
      textSize: 24,
      textPosition: 'bottom',
      volume: 1.0,
      speed: 1.0,
      width: 1280,
      height: 720,
    });
  };

  return (
    <div className="bg-[#0D0D0F] border border-neutral-800 rounded-lg overflow-hidden h-full flex flex-col shadow-xl" id="media-hub-container">
      {/* Header tabs */}
      <div className="flex border-b border-neutral-800 bg-[#09090A] px-2 pt-2">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide border-t-2 rounded-t-sm transition-all focus:outline-none ${
            activeTab === 'upload'
              ? 'bg-[#0D0D0F] border-indigo-400 text-indigo-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-100 hover:bg-[#0D0D0F]/50'
          }`}
          id="tab-upload"
        >
          <Upload size={14} />
          Upload Video
        </button>
        <button
          onClick={() => setActiveTab('samples')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide border-t-2 rounded-t-sm transition-all focus:outline-none ${
            activeTab === 'samples'
              ? 'bg-[#0D0D0F] border-indigo-400 text-indigo-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-100 hover:bg-[#0D0D0F]/50'
          }`}
          id="tab-samples"
        >
          <Film size={14} />
          Stock Library
        </button>
        <button
          onClick={() => setActiveTab('exports')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide border-t-2 rounded-t-sm transition-all relative focus:outline-none ${
            activeTab === 'exports'
              ? 'bg-[#0D0D0F] border-indigo-400 text-indigo-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-100 hover:bg-[#0D0D0F]/50'
          }`}
          id="tab-exports"
        >
          <History size={14} />
          Export History
          {exportedVideos.length > 0 && (
            <span className="absolute -top-1 right-2 w-4 h-4 bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center rounded-full">
              {exportedVideos.length}
            </span>
          )}
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-4 h-full flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-neutral-200 tracking-wider uppercase mb-1">Add Project Video Assets</h3>
              <p className="text-xs text-neutral-400 leading-normal">Upload video clips from your local browser to trim, cut, apply visual filter modifiers, and stitch together.</p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 min-h-[160px] border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all my-3 ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-950/20 text-indigo-400 scale-[0.99]'
                  : 'border-neutral-800 bg-[#121214]/60 text-neutral-400 hover:border-neutral-700 hover:bg-[#121214]'
              }`}
              id="upload-dragzone"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*"
                className="hidden"
                id="video-uploader-input"
              />
              <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center text-neutral-300 mb-3 border border-neutral-800">
                <Upload size={20} className={isProcessing ? 'animate-bounce text-indigo-400' : 'text-neutral-300'} />
              </div>
              {isProcessing ? (
                <div className="w-full px-8">
                  <p className="text-xs font-semibold text-neutral-350 mb-2">Uploading to Cloudinary... {uploadProgress}%</p>
                  <div className="w-full bg-[#121214] h-1.5 rounded overflow-hidden border border-neutral-805">
                    <div className="bg-indigo-500 h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-neutral-300">Drag & drop your video file here</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Or click to browse storage files</p>
                  <p className="text-[9px] text-neutral-600 mt-3 font-mono">Accepts MP4, WEBM, MOV, etc.</p>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-900/50 rounded text-rose-405 text-xs text-center" id="upload-error">
                {errorMsg}
              </div>
            )}

            <div className="bg-[#121214] p-3 rounded border border-neutral-800/80">
              <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <CloudLightning size={12} className="text-amber-500" />
                No file ready?
              </h4>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Click the <b className="text-neutral-300 font-medium">Stock Library</b> tab above to pick high-speed nature or sample renders to design your project immediately.
              </p>
            </div>
          </div>
        )}

        {/* Stock Samples Tab */}
        {activeTab === 'samples' && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold text-neutral-200 tracking-wider uppercase mb-1">Stock Cinematic Elements</h3>
              <p className="text-xs text-neutral-400">Load sample resources directly into your global timeline. Fully compatible with cutting and visual filters.</p>
            </div>

            <div className="grid gap-2 mt-3" id="stock-samples-grid">
              {SAMPLE_VIDEOS.map((sample) => (
                <div
                  key={sample.id}
                  className="p-3 bg-[#121214] border border-neutral-800/80 hover:border-neutral-700 rounded flex items-start gap-3 group transition-all"
                >
                  <div className="w-10 h-10 bg-neutral-900 rounded border border-neutral-800 flex items-center justify-center text-xl shrink-0">
                    {sample.thumbnail}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-200 truncate">{sample.name}</span>
                      <span className="text-[10px] font-mono text-indigo-450 shrink-0 flex items-center gap-1">
                        <Clock size={10} />
                        {sample.duration}s
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">{sample.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] bg-neutral-900 text-neutral-500 px-1.5 py-0.5 rounded border border-neutral-850 font-medium">
                        {sample.category}
                      </span>
                      <button
                        onClick={() => loadSampleVideo(sample)}
                        className="flex items-center gap-1 py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded transition-colors cursor-pointer shadow-sm"
                      >
                        <Plus size={10} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export History Tab */}
        {activeTab === 'exports' && (
          <div className="space-y-3 h-full flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-neutral-200 tracking-wider uppercase mb-1">Previous Exported Videos</h3>
              <p className="text-xs text-neutral-400 leading-normal">Your browser local rendering history. Download or play completed projects anytime.</p>
            </div>

            {exportedVideos.length === 0 ? (
              <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center text-center p-6 border border-neutral-800/40 rounded bg-[#121214]/60 my-3 animate-fade-in">
                <History size={24} className="text-neutral-700 mb-2" />
                <p className="text-xs text-neutral-400 font-semibold">No exports yet</p>
                <p className="text-[10px] text-neutral-600 mt-1 max-w-[200px] leading-normal">Use the Export panel on the right after putting together your masterpiece.</p>
              </div>
            ) : (
              <div className="space-y-2.5 my-3 flex-1 overflow-y-auto pr-0.5" id="exports-list">
                {exportedVideos.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-3 bg-[#121214] border border-neutral-800/80 rounded flex items-center justify-between gap-3 hover:border-neutral-700 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-xs font-semibold text-neutral-200 truncate">{exp.name}</span>
                        <span className="text-[10px] font-mono text-emerald-400 whitespace-nowrap">{formatTimecode(exp.duration)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                        <span>{exp.size}</span>
                        <span>•</span>
                        <span>{exp.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={exp.blobUrl}
                        download={exp.name}
                        title="Download MP4/WebM Video file"
                        className="p-1.5 bg-emerald-950/40 hover:bg-emerald-650 border border-emerald-900 text-emerald-400 hover:text-white rounded transition cursor-pointer"
                        id={`btn-download-${exp.id}`}
                      >
                        <Download size={13} />
                      </a>
                      <button
                        onClick={() => onDeleteExport(exp.id)}
                        title="Delete from cache"
                        className="p-1.5 bg-neutral-900 hover:bg-rose-950/80 border border-neutral-800 text-neutral-500 hover:text-rose-450 rounded transition cursor-pointer"
                        id={`btn-delete-${exp.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] text-neutral-500 leading-normal p-2.5 rounded bg-[#121214] border border-neutral-800/50 mt-auto">
              <span className="font-semibold text-neutral-400 block mb-0.5">💡 Performance Tip:</span>
              Exported videos remain stored in browser memory/IndexedDB for this session so you can preview them side-by-side!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
