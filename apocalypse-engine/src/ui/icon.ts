import {
  Activity, Waves, Wind, Radio, Maximize, ShieldCheck, Sun, Settings2, PanelLeftClose,
  PanelLeftOpen, Layers2, Network, Camera, Maximize2, Play, Pause, StepForward,
  RotateCcw, BookmarkPlus, ScanLine, Check, Building2, TriangleAlert, Compass,
  CircleCheck, ArrowUpRight, Zap, BookmarkCheck, Clock3, Bookmark, Square,
} from 'lucide';

const icons: Record<string, string> = {
  activity: Activity, waves: Waves, wind: Wind, radio: Radio, maximize: Maximize,
  'shield-check': ShieldCheck, sun: Sun, 'settings-2': Settings2, 'panel-left-close': PanelLeftClose,
  'panel-left-open': PanelLeftOpen, 'layers-2': Layers2, network: Network, camera: Camera,
  'maximize-2': Maximize2, play: Play, pause: Pause, 'step-forward': StepForward,
  'rotate-ccw': RotateCcw, 'bookmark-plus': BookmarkPlus, 'scan-line': ScanLine, check: Check,
  'building-2': Building2, 'triangle-alert': TriangleAlert, compass: Compass,
  'circle-check': CircleCheck, 'arrow-up-right': ArrowUpRight, zap: Zap,
  'bookmark-check': BookmarkCheck, 'clock-3': Clock3, bookmark: Bookmark, square: Square,
};

export function icon(name: string, label?: string) {
  const svg = icons[name];
  if (!svg) throw new Error(`Unknown icon: ${name}`);
  return svg.replace(/class="[^"]*"/, 'class="icon"')
    .replace('<svg', `<svg aria-hidden="${label ? 'false' : 'true'}"${label ? ` aria-label="${escapeAttribute(label)}"` : ''}`);
}

function escapeText(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
