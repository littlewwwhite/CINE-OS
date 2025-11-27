export enum ProcessingState {
  IDLE = 'IDLE',
  ANALYZING_SCRIPT = 'ANALYZING_SCRIPT',
  GENERATING_SHOTS = 'GENERATING_SHOTS',
  GENERATING_VISUALS = 'GENERATING_VISUALS',
  GENERATING_VIDEO = 'GENERATING_VIDEO',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export type AssetType = 'CHARACTER' | 'LOCATION' | 'PROP';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  visualDescription: string;
  avatarUrl?: string;
}

export interface Shot {
  id: string;
  shotType: string;
  visualPrompt: string;
  action: string;
  assetIds: string[];
  imageUrl?: string;
  videoUrl?: string;
}

export interface Beat {
  id: string;
  description: string;
  shots: Shot[];
}

export interface Scene {
  id: string;
  slugline: string; // e.g. INT. LAB - NIGHT
  beats: Beat[];
  isExpanded: boolean; // UI toggle for scene
}

export interface ScriptData {
  title: string;
  genre: string;
  logline: string;
  assets: Asset[];
  scenes: Scene[]; // Changed from beats: SceneBeat[] to scenes: Scene[]
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface Project {
  id: string;
  title: string;
  lastModified: string;
  sceneCount: number;
  thumbnailUrl?: string;
  progress: number; // 0-100
  status: 'DRAFT' | 'RENDERING' | 'COMPLETED';
}