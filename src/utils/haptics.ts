/**
 * High-fidelity simulated haptic engine.
 * Combines physical device vibration (navigator.vibrate) with 
 * subtle, tactile micro-acoustic synthesis via Web Audio API 
 * so haptics are felt/heard across all modern devices.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export type HapticType = 'lift' | 'hover' | 'drop' | 'cancel' | 'resolve';

export function triggerHaptic(type: HapticType = 'drop'): void {
  // 1. Hardware vibration if supported
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      switch (type) {
        case 'lift':
          navigator.vibrate(15);
          break;
        case 'hover':
          navigator.vibrate(8);
          break;
        case 'drop':
          navigator.vibrate([20, 30, 20]);
          break;
        case 'cancel':
          navigator.vibrate([30, 40]);
          break;
        case 'resolve':
          navigator.vibrate([15, 20, 25, 30]);
          break;
      }
    } catch {
      // Ignore vibration errors if blocked by browser policy
    }
  }

  // 2. Micro-acoustic tactile pulse via Web Audio API
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case 'lift': {
        // Crisp, subtle mechanical latch click (240Hz -> 320Hz)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case 'hover': {
        // High-frequency subtle ticking hover sound (400Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.035);
        break;
      }
      case 'drop': {
        // Warm, satisfying low thud (160Hz -> 80Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case 'cancel': {
        // Soft double blip
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.07);
        break;
      }
      case 'resolve': {
        // Sparkling rising chime
        const freqs = [330, 440, 550, 660];
        freqs.forEach((f, i) => {
          const subOsc = ctx.createOscillator();
          const subGain = ctx.createGain();
          subOsc.type = 'sine';
          subOsc.frequency.setValueAtTime(f, now + i * 0.05);
          subGain.gain.setValueAtTime(0.035, now + i * 0.05);
          subGain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.12);
          subOsc.connect(subGain);
          subGain.connect(ctx.destination);
          subOsc.start(now + i * 0.05);
          subOsc.stop(now + i * 0.05 + 0.13);
        });
        break;
      }
    }
  } catch {
    // Audio contexts might be blocked until first user gesture
  }
}
