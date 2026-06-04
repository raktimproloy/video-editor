import { VideoClip } from '../types';

// Format seconds into accurate SMPTE style time: hh:mm:ss.SS
export function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  const pad = (n: number) => n.toString().padStart(2, '0');
  
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms)}`;
  }
  return `${pad(mins)}:${pad(secs)}.${pad(ms)}`;
}

// Extract standard video file metadata
export function getVideoMetadata(file: File | Blob): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration || 0,
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720,
      });
      cleanup();
    };

    video.onerror = () => {
      reject(new Error('Failed to load video metadata. Please ensure the file is a valid video format.'));
      cleanup();
    };
  });
}

// Professional CORS-enabled royalty-free testing videos
export const SAMPLE_VIDEOS = [
  {
    id: 'sample-nature',
    name: 'Serene Nature and Waterways',
    duration: 15,
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    category: 'Nature',
    thumbnail: '🌊',
    description: 'Beautiful flowing mountain stream with smooth scenic movement.'
  },
  {
    id: 'sample-bunny',
    name: 'Sintel Animated Film Scene',
    duration: 52,
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    category: 'Cinematic',
    thumbnail: '🏹',
    description: 'High definition fantasy animation segment from Sintel Open Source Film.'
  },
  {
    id: 'sample-desert',
    name: 'Cosmic Tech Trailer Segment',
    duration: 14,
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    category: 'Motion Graphics',
    thumbnail: '⚡',
    description: 'Vibrant futuristic visual graphics showing digital transitions.'
  }
];

// Helper to apply filters to a canvas context 2D
export function applyCanvasFilter(
  ctx: CanvasRenderingContext2D,
  filterType: VideoClip['filter']
) {
  switch (filterType) {
    case 'grayscale':
      ctx.filter = 'grayscale(100%)';
      break;
    case 'sepia':
      ctx.filter = 'sepia(100%)';
      break;
    case 'invert':
      ctx.filter = 'invert(100%)';
      break;
    case 'warm':
      ctx.filter = 'contrast(110%) saturate(120%) sepia(20%)';
      break;
    case 'cool':
      ctx.filter = 'contrast(100%) saturate(90%) hue-rotate(15deg)';
      break;
    case 'vintage':
      ctx.filter = 'sepia(40%) contrast(85%) brightness(110%)';
      break;
    case 'highcontrast':
      ctx.filter = 'contrast(160%) brightness(95%)';
      break;
    case 'none':
    default:
      ctx.filter = 'none';
      break;
  }
}
