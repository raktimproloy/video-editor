export interface VideoClip {
  id: string;
  name: string;
  blobUrl: string;
  file?: File;
  duration: number; // total duration of the original video in seconds
  startOffset: number; // slice start point in original video
  endOffset: number; // slice end point in original video
  timelineStart: number; // start time on the global editor timeline
  filter: 'none' | 'grayscale' | 'sepia' | 'invert' | 'warm' | 'cool' | 'vintage' | 'highcontrast';
  textOverlay?: string;
  textPosition: 'top' | 'middle' | 'bottom';
  textColor: string;
  textSize: number; // font size in px
  volume: number; // 0 to 1
  speed: number; // 0.5 to 2.0
  width?: number;
  height?: number;
}

export interface ExportedVideo {
  id: string;
  name: string;
  blobUrl: string;
  date: string;
  duration: number;
  size: string;
}

export interface VideoProject {
  id: string;
  name: string;
  clips: VideoClip[];
  updatedAt: string;
}
