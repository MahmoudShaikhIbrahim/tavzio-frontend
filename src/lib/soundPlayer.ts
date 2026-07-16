import type { NotificationSetting } from '../types';

// Presets are genuinely synthesized tones, not placeholder references to
// files that don't exist - this works immediately, with zero audio assets
// to bundle or host. Each preset is a distinct, recognizable pattern so
// staff can tell events apart by ear without looking at the screen.
export const SOUND_PRESETS = [
  { id: 'default', label: 'Default (single chime)' },
  { id: 'bell', label: 'Bell (two-tone)' },
  { id: 'urgent', label: 'Urgent (rapid triple beep)' },
  { id: 'soft', label: 'Soft (low tone)' },
] as const;

let audioCtx: AudioContext | null = null;
function getContext() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function beep(freq: number, startAt: number, duration: number, ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.3, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

export function playPresetSound(presetId: string) {
  const ctx = getContext();
  const now = ctx.currentTime;

  switch (presetId) {
    case 'bell':
      beep(880, now, 0.25, ctx);
      beep(660, now + 0.15, 0.35, ctx);
      break;
    case 'urgent':
      beep(1046, now, 0.1, ctx);
      beep(1046, now + 0.15, 0.1, ctx);
      beep(1046, now + 0.3, 0.15, ctx);
      break;
    case 'soft':
      beep(392, now, 0.4, ctx);
      break;
    default:
      beep(784, now, 0.2, ctx);
      break;
  }
}

export function playNotificationSound(setting: NotificationSetting | undefined) {
  if (!setting?.enabled) return;
  if (setting.sound === 'custom' && setting.customUrl) {
    new Audio(setting.customUrl).play().catch(() => {});
  } else {
    playPresetSound(setting.sound);
  }
}
