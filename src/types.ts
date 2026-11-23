export interface FocusRegion {
  /** Horizontal focal point on the anatomical image (0-100%) */
  x: number;
  /** Vertical focal point on the anatomical image (0-100%) */
  y: number;
  /** Zoom factor, e.g. 1.0 (full plate) to 2.2 (tight zoom) */
  scale: number;
  /** Scene-relative second when zoom begins */
  startSec?: number;
}

export interface AnatomyCallout {
  id: string;
  /** Exact target point on the anatomical image (0-100%) */
  targetX: number;
  targetY: number;
  /** Label badge position on the anatomical image (0-100%) */
  labelX: number;
  labelY: number;
  /** Primary Latin / English anatomical term */
  label: string;
  /** Optional short Arabic or functional cue */
  sublabel?: string;
  /** Accent hex color (defaults to warm clinical coral #F97316) */
  color?: string;
  /** Scene-relative second when this callout animates in */
  startSec: number;
  /** Optional scene-relative second when highlight fades back */
  endSec?: number;
}

export interface KeyPoint {
  term: string;
  note?: string;
  startSec?: number;
}

export interface TitleSceneData {
  type: 'title';
  durationSec: number;
  courseBadge: string;
  titleAr: string;
  titleEn: string;
  subtitle?: string;
  species?: string[];
  accentColor?: string;
  /** Optional hero anatomical plate filename in images/ */
  image?: string;
}

export interface AnatomySceneData {
  type: 'anatomy';
  durationSec: number;
  sectionLabel: string;
  titleAr: string;
  titleEn?: string;
  /** Filename inside lecture images/ folder */
  image: string;
  /** Optional attribution caption (e.g. Wikimedia Commons / Course Atlas) */
  imageCredit?: string;
  /** Light card background behind anatomical diagrams (default true for white plates) */
  lightPlateBg?: boolean;
  /** Smooth camera zoom / pan focus steps */
  focusSteps?: FocusRegion[];
  /** Coordinate-calibrated animated arrows & anatomical labels */
  callouts?: AnatomyCallout[];
  /** Concise structured points shown in side panel */
  keyPoints?: KeyPoint[];
}

export interface ComparisonColumn {
  species: string;
  speciesAr?: string;
  badgeColor?: string;
  image?: string;
  points: string[];
}

export interface ComparisonSceneData {
  type: 'comparison';
  durationSec: number;
  sectionLabel: string;
  titleAr: string;
  titleEn?: string;
  columns: ComparisonColumn[];
}

export interface ClinicalSceneData {
  type: 'clinical';
  durationSec: number;
  badge: string;
  titleAr: string;
  titleEn?: string;
  severity?: 'info' | 'warning' | 'pearl';
  bullets: Array<{
    heading: string;
    detail: string;
    startSec?: number;
  }>;
  image?: string;
  imageCredit?: string;
}

export interface MindMapBranch {
  id: string;
  label: string;
  color: string;
  startSec?: number;
  children: string[];
}

export interface MindMapSceneData {
  type: 'mindmap';
  durationSec: number;
  sectionLabel: string;
  titleAr: string;
  centerLabel: string;
  centerSublabel?: string;
  branches: MindMapBranch[];
}

export type SceneData =
  | TitleSceneData
  | AnatomySceneData
  | ComparisonSceneData
  | ClinicalSceneData
  | MindMapSceneData;

export interface ImageDimension {
  width: number;
  height: number;
}

export interface LectureManifest {
  id: string;
  title: string;
  fps?: number;
  width?: number;
  height?: number;
  /** Optional filename inside lecture directory (e.g., "audio.wav" or "audio.mp3") */
  audioFile?: string;
  /** Optional cloud TTS fallback script if audioFile is omitted */
  tts?: {
    voice?: string;
    rate?: string;
    text: string;
  };
  /** Auto-populated by render-cloud.mjs for exact anatomical callout projection */
  imageDims?: Record<string, ImageDimension>;
  scenes: SceneData[];
}
