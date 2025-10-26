// Simple helper to initialize a guitar Soundfont instrument and play notes.
// Uses soundfont-player which is already installed in the project.
import Soundfont from 'soundfont-player';

export interface GuitarInstrumentHandle {
  context: AudioContext;
  instrument: any; // soundfont-player returns a generic instrument object
}

export async function initGuitarInstrument(): Promise<GuitarInstrumentHandle | null> {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AudioCtx();
    // Try nylon first; fallback to steel
    let instrument: any;
    try {
      instrument = await Soundfont.instrument(ctx, 'acoustic_guitar_nylon');
    } catch {
      instrument = await Soundfont.instrument(ctx, 'acoustic_guitar_steel');
    }
    return { context: ctx, instrument };
  } catch (err) {
    console.warn('Guitar audio init failed:', err);
    return null;
  }
}

export function playGuitarChord(handle: GuitarInstrumentHandle | null, midis: number[], durationSec: number) {
  if (!handle || !midis.length) return;
  const now = handle.context.currentTime;
  midis.forEach(midi => {
    try {
      handle.instrument.play(midi, now, { duration: durationSec });
    } catch (err) {
      // Ignore individual note play failures
    }
  });
}
