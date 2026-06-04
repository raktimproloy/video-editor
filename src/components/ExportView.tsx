import React, { useState, useRef, useEffect } from 'react';
import { Download, Film, Sparkles, CheckCircle2, AlertCircle, Loader2, Cpu, FileVideo } from 'lucide-react';
import { VideoClip, ExportedVideo } from '../types';
import { applyCanvasFilter, formatTimecode } from '../utils/videoUtils';

interface ExportViewProps {
  clips: VideoClip[];
  totalDuration: number;
  onExportComplete: (newExport: ExportedVideo) => void;
}

export default function ExportView({ clips, totalDuration, onExportComplete }: ExportViewProps) {
  const [exportName, setExportName] = useState('Pro_Edit_Sequence');
  const [resolution, setResolution] = useState<'source' | '1080' | '720' | '480'>('source');
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progress, setProgress] = useState(0);
  const [renderLogs, setRenderLogs] = useState<string[]>([]);
  const [latestExport, setLatestExport] = useState<ExportedVideo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkRef = useRef<Blob[]>([]);
  const renderIntervalRef = useRef<number | null>(null);

  // Clean elements on unmount
  useEffect(() => {
    return () => {
      if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
    };
  }, []);

  const startExportRendering = async () => {
    if (clips.length === 0) {
      setErrorMsg('Cannot export an empty project timeline. Add some video blocks first.');
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setErrorMsg(null);
    setLatestExport(null);
    chunkRef.current = [];

    // Allow React to flush the state and mount the canvas node before querying it
    await new Promise((resolve) => setTimeout(resolve, 50));

    let resWidth = 1280;
    let resHeight = 720;

    if (resolution === 'source') {
      // Use highest loaded source resolution
      const measuredClips = clips.filter(c => c.width && c.height);
      if (measuredClips.length > 0) {
        let maxArea = 0;
        for (const c of measuredClips) {
          const area = (c.width || 0) * (c.height || 0);
          if (area > maxArea) {
            maxArea = area;
            resWidth = c.width!;
            resHeight = c.height!;
          }
        }
      } else {
        resWidth = 1920;
        resHeight = 1080;
      }
    } else if (resolution === '1080') {
      resWidth = 1920;
      resHeight = 1080;
    } else if (resolution === '480') {
      resWidth = 854;
      resHeight = 480;
    }

    setRenderLogs([
      `Initializing browser frame compilation engine...`,
      `Target Resolution: ${resWidth}x${resHeight} (${resolution === 'source' ? 'Original Source' : 'HD Scaling'}).`,
      `Preparing offline media streaming canvas tracks...`,
    ]);

    // Helpers to pause execution until video load/seek callbacks fire asynchronously
    const loadVideoSrc = (v: HTMLVideoElement, src: string): Promise<void> => {
      return new Promise((resolve) => {
        const onCanPlay = () => {
          v.removeEventListener('canplay', onCanPlay);
          v.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          v.removeEventListener('canplay', onCanPlay);
          v.removeEventListener('error', onError);
          resolve();
        };
        v.addEventListener('canplay', onCanPlay);
        v.addEventListener('error', onError);
        v.src = src;
        v.load();
      });
    };

    const seekVideo = (v: HTMLVideoElement, time: number): Promise<void> => {
      return new Promise((resolve) => {
        const onSeeked = () => {
          v.removeEventListener('seeked', onSeeked);
          v.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          v.removeEventListener('seeked', onSeeked);
          v.removeEventListener('error', onError);
          resolve();
        };
        v.addEventListener('seeked', onSeeked);
        v.addEventListener('error', onError);
        v.currentTime = time;
      });
    };

    try {
      // 1. Prepare rendering canvas
      const canvas = exportCanvasRef.current;
      if (!canvas) throw new Error('Canvas rendering node not mounted.');
      canvas.width = resWidth;
      canvas.height = resHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to resolve 2D pipeline rendering frame context.');

      // 2. Prepare rendering backing audio/video channel
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = false; // Muted must be false for audio capture!
      video.preload = 'auto';
      exportVideoRef.current = video;

      // 3. Setup Web Audio API to capture the audio without playing it out loud
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createMediaElementSource(video);
      source.connect(dest);

      // 4. Setup Media Recorder on Canvas stream + Audio stream
      let selectedMime = 'video/webm';
      const mimesToTry = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus', // Use opus for audio
        'video/webm',
        'video/mp4'
      ];
      for (const mime of mimesToTry) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      // We capture standard cinematic 30 FPS frame rate
      const canvasStream = canvas.captureStream(30); 
      const audioTracks = dest.stream.getAudioTracks();
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks
      ]);

      const recorder = new MediaRecorder(combinedStream, { 
        mimeType: selectedMime, 
        videoBitsPerSecond: resolution === 'source' ? 12000000 : 8000000 
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunkRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunkRef.current, { type: selectedMime });
        const fileSizeStr = `${(blob.size / (1024 * 1024)).toFixed(2)} MB`;
        const fileName = `${exportName.trim().replace(/\s+/g, '_')}_${resolution === 'source' ? 'Source' : resolution + 'p'}.${selectedMime.includes('mp4') ? 'mp4' : 'webm'}`;

        setRenderLogs((prev) => [...prev, `🟢 Rendering complete! Packing finalized to ${fileSizeStr}.`]);
        setRenderLogs((prev) => [...prev, `☁️ Initiating Cloudinary upload...`]);
        
        setIsExporting(false);
        setIsUploading(true);
        setUploadProgress(0);

        try {
          const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
          const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

          if (!cloudName || !uploadPreset) {
            throw new Error('Cloudinary credentials are not configured in .env');
          }

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
            formData.append('file', blob, fileName);
            formData.append('upload_preset', uploadPreset);
            xhr.send(formData);
          });

          const newExport: ExportedVideo = {
            id: `export-${Date.now()}`,
            name: fileName,
            blobUrl: cloudinaryUrl, // Using Cloudinary URL instead of local URL
            date: new Date().toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' }),
            duration: totalDuration,
            size: fileSizeStr,
          };

          setLatestExport(newExport);
          onExportComplete(newExport);
        } catch (err: any) {
          setErrorMsg(err?.message || 'Error uploading rendered video to Cloudinary.');
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      };

      // 4. Start recording execution
      recorder.start();
      setRenderLogs((prev) => [...prev, `▶️ Recording stream init. Capture target [${selectedMime}].`]);

      // 5. Real-time playback and render loop
      const processRenderLoop = async () => {
        try {
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }

          let cumulativeTime = 0;

          for (const activeClip of clips) {
            setRenderLogs((prev) => [
              ...prev.slice(-4), // keep logs compact
              `🎬 Splicing: "${activeClip.name}" (FX: ${activeClip.filter})`,
            ]);
            
            await loadVideoSrc(video, activeClip.blobUrl);
            video.currentTime = activeClip.startOffset;
            video.playbackRate = activeClip.speed;
            video.volume = activeClip.volume !== undefined ? activeClip.volume : 1.0;
            
            await video.play();

            await new Promise<void>((resolve) => {
              let rafId: number;
              const clipRealDuration = (activeClip.endOffset - activeClip.startOffset) / activeClip.speed;
              
              const drawFrame = () => {
                const elapsedInClip = video.currentTime - activeClip.startOffset;
                
                // Check if clip has finished its segment
                if (elapsedInClip >= clipRealDuration || video.ended) {
                  video.pause();
                  cancelAnimationFrame(rafId);
                  cumulativeTime += clipRealDuration;
                  resolve();
                  return;
                }

                // Draw canvas frame
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                applyCanvasFilter(ctx, activeClip.filter);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctx.restore();

                // Render subtitle overlays
                if (activeClip.textOverlay && activeClip.textOverlay.trim()) {
                  ctx.save();
                  const size = (activeClip.textSize || 24) * (resHeight / 720);
                  ctx.font = `bold ${size}px "Inter", sans-serif`;
                  ctx.fillStyle = activeClip.textColor || '#ffffff';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';

                  const text = activeClip.textOverlay;
                  const x = canvas.width / 2;
                  let y = canvas.height - (60 * (resHeight / 720));

                  if (activeClip.textPosition === 'top') {
                    y = 60 * (resHeight / 720);
                  } else if (activeClip.textPosition === 'middle') {
                    y = canvas.height / 2;
                  }

                  // Translucent bg bar
                  const textWidth = ctx.measureText(text).width;
                  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
                  ctx.beginPath();
                  ctx.roundRect(x - textWidth / 2 - 16, y - size / 2 - 8, textWidth + 32, size + 16, 8);
                  ctx.fill();

                  // Foreground & outline
                  ctx.strokeStyle = '#000000';
                  ctx.lineWidth = Math.max(2, size / 10);
                  ctx.strokeText(text, x, y);
                  ctx.fillStyle = activeClip.textColor || '#ffffff';
                  ctx.fillText(text, x, y);
                  ctx.restore();
                }

                // Draw watermark / render signature
                ctx.save();
                ctx.font = '500 12px "JetBrains Mono", monospace';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.textAlign = 'right';
                ctx.fillText('WebVideoEditor Render Tube', canvas.width - 24, 28);
                ctx.restore();

                // Progress update
                const currentTotalElapsed = cumulativeTime + elapsedInClip;
                const completePercent = Math.min(99, Math.floor((currentTotalElapsed / totalDuration) * 100));
                setProgress(completePercent);

                rafId = requestAnimationFrame(drawFrame);
              };
              
              rafId = requestAnimationFrame(drawFrame);
            });
          }

          // Complete recording
          setProgress(100);
          recorder.stop();
        } catch (err: any) {
          setIsExporting(false);
          setErrorMsg(err?.message || 'GPU composition encountered an error.');
        }
      };

      processRenderLoop();

    } catch (err: any) {
      setIsExporting(false);
      setErrorMsg(err?.message || 'GPU composition encountered an error.');
    }
  };

  return (
    <div className="bg-[#0D0D0F] border border-neutral-800 rounded-lg p-4 shadow-xl flex flex-col gap-4 h-full" id="export-panel">
      <div>
        <h3 className="text-xs font-bold text-neutral-200 tracking-wider flex items-center gap-2 mb-1">
          <Cpu size={14} className="text-indigo-400" />
          COMPILE & EXPORT
        </h3>
        <p className="text-xs text-neutral-400 leading-normal">Assemble timeline sequence directly into a single integrated digital video element.</p>
      </div>

      {!isExporting && !latestExport ? (
        /* Setup Phase Form */
        <div className="space-y-4" id="export-setup">
          {/* Filename configure */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-wider">Output File Name</label>
            <input
              type="text"
              value={exportName}
              onChange={(e) => setExportName(e.target.value.replace(/[^a-zA-Z0-9_\-\s]/g, ''))}
              placeholder="Project_Sequence_Cut"
              className="w-full bg-[#121214] border border-neutral-805 focus:border-indigo-400 rounded-sm px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700 transition"
            />
          </div>

          {/* Target resolution configs */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-wider block">Target Render Option</label>
            <div className="grid grid-cols-4 gap-1 bg-[#121214] p-1 rounded border border-neutral-805">
              <button
                type="button"
                onClick={() => setResolution('source')}
                className={`py-2 text-[10px] font-bold text-center rounded transition border focus:outline-none cursor-pointer ${
                  resolution === 'source'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-neutral-900 border-transparent text-neutral-450 hover:text-neutral-200'
                }`}
              >
                Source
              </button>
              <button
                type="button"
                onClick={() => setResolution('1080')}
                className={`py-2 text-[10px] font-bold text-center rounded transition border focus:outline-none cursor-pointer ${
                  resolution === '1080'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-neutral-900 border-transparent text-neutral-450 hover:text-neutral-200'
                }`}
              >
                1080p Ultra
              </button>
              <button
                type="button"
                onClick={() => setResolution('720')}
                className={`py-2 text-[10px] font-bold text-center rounded transition border focus:outline-none cursor-pointer ${
                  resolution === '720'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-neutral-900 border-transparent text-neutral-450 hover:text-neutral-200'
                }`}
              >
                720p HD
              </button>
              <button
                type="button"
                onClick={() => setResolution('480')}
                className={`py-2 text-[10px] font-bold text-center rounded transition border focus:outline-none cursor-pointer ${
                  resolution === '480'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-neutral-900 border-transparent text-neutral-450 hover:text-neutral-200'
                }`}
              >
                480p SD
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 leading-normal">
              <b>Source Lossless</b> compiles the playhead timeline directly at your uploaded video's exact width and height, preserving original pixels and quality without loss.
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-rose-400 text-xs border border-rose-900/40 p-2.5 rounded bg-rose-950/20">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Trigger compilation */}
          <button
            onClick={startExportRendering}
            disabled={clips.length === 0}
            className="w-full justify-center flex items-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold text-xs rounded transition-all cursor-pointer shadow shadow-indigo-500/10 select-none"
            id="btn-trigger-export"
          >
            <Sparkles size={13} className="text-amber-300 pointer-events-none" />
            Compile & Export Sequence
          </button>
        </div>
      ) : isExporting ? (
        /* Progress Screen Rendering */
        <div className="space-y-4" id="export-progress">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1.5 animate-pulse">
              <Loader2 size={12} className="animate-spin text-indigo-400" />
              RENDERING SEQUENCE
            </span>
            <span className="text-xs font-mono font-bold text-neutral-300">{progress}%</span>
          </div>

          {/* Progress bar container */}
          <div className="w-full bg-[#121214] h-2 rounded overflow-hidden border border-neutral-805">
            <div
              className="bg-indigo-600 h-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Live drawing board mini-monitor */}
          <div className="aspect-video w-full bg-[#050505] rounded overflow-hidden border border-neutral-805 relative leading-none">
            <canvas ref={exportCanvasRef} className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
              <span className="text-[9px] font-mono text-neutral-400 bg-[#09090A]/95 border border-neutral-805 px-2 py-1 rounded">
                COMPILING FRAME STREAM AT 30FPS
              </span>
            </div>
          </div>

          {/* Terminal Console Logs */}
          <div className="bg-[#09090A] rounded p-2.5 border border-neutral-805 font-mono text-[9px] text-neutral-405 space-y-1 h-[80px] overflow-y-auto">
            {renderLogs.map((log, index) => (
              <div key={index} className="truncate">
                <span className="text-neutral-600">❯ </span>
                {log}
              </div>
            ))}
          </div>
        </div>
      ) : isUploading ? (
        /* Progress Screen Uploading */
        <div className="space-y-4" id="upload-progress">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase flex items-center gap-1.5 animate-pulse">
              <Loader2 size={12} className="animate-spin text-amber-400" />
              UPLOADING TO CLOUDINARY
            </span>
            <span className="text-xs font-mono font-bold text-neutral-300">{uploadProgress}%</span>
          </div>

          {/* Progress bar container */}
          <div className="w-full bg-[#121214] h-2 rounded overflow-hidden border border-neutral-805">
            <div
              className="bg-amber-500 h-full transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          
          <div className="text-[10px] text-neutral-400 text-center">
            Your optimized video is securely saving to the cloud.
          </div>
        </div>
      ) : (
        /* Render Success Completed State */
        <div className="space-y-4 text-center" id="export-success">
          <div className="py-2 flex flex-col items-center justify-center text-center">
            <CheckCircle2 size={36} className="text-emerald-450 mb-2 animate-bounce" />
            <h4 className="text-xs font-bold text-neutral-200">Video Rendered Successfully!</h4>
            <p className="text-[10.5px] text-neutral-400 mt-1 max-w-[220px]">
              Ready at {latestExport?.size}. Click download to fetch completed MP4/WebM video file.
            </p>
          </div>

          {/* Video Player */}
          {latestExport?.blobUrl && (
            <div className="bg-black rounded-md overflow-hidden border border-neutral-800 shadow-inner">
              <video 
                src={latestExport.blobUrl} 
                controls 
                className="w-full max-h-48 object-contain outline-none"
                controlsList="nodownload"
              />
            </div>
          )}

          <div className="bg-[#09090A] rounded p-3 border border-neutral-805 text-left space-y-1.5">
            <div className="flex items-center gap-1 text-neutral-300 font-semibold text-xs truncate">
              <FileVideo size={13} className="text-indigo-400 shrink-0" />
              <span>{latestExport?.name}</span>
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-neutral-500 font-mono border-t border-neutral-850 pt-2">
              <span>Duration: {formatTimecode(latestExport?.duration || 0)}</span>
              <span>Weight: {latestExport?.size}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <a
              href={latestExport?.blobUrl}
              download={latestExport?.name}
              className="flex-1 justify-center flex items-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors cursor-pointer shadow"
              id="btn-direct-download-rendered"
            >
              <Download size={13} />
              Save to Device
            </a>
            <button
              onClick={() => setLatestExport(null)}
              className="px-3 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 text-xs rounded transition uppercase tracking-wider text-[10px] font-semibold"
              id="btn-new-render"
            >
              New
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
