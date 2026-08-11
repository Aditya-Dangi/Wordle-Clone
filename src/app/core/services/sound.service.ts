import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';

export type SoundName = 'key' | 'correct' | 'present' | 'absent' | 'invalid' | 'win' | 'lose' | 'achievement' | 'levelup';

/** Tiny WebAudio synth - no audio files, so every sound effect is generated at runtime. */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly storage = inject(StorageService);
  private audioCtx: AudioContext | null = null;

  private ensureCtx(): AudioContext | null {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.audioCtx) this.audioCtx = new Ctor();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    return this.audioCtx;
  }

  private tone(freq: number, duration: number, waveform: OscillatorType = 'sine', delay = 0): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveform;
    osc.frequency.value = freq;
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private readonly defs: Record<SoundName, () => void> = {
    key: () => this.tone(440, 0.05, 'square'),
    correct: () => {
      this.tone(660, 0.12);
      this.tone(880, 0.14, 'sine', 0.09);
    },
    present: () => this.tone(520, 0.1),
    absent: () => this.tone(200, 0.08, 'triangle'),
    invalid: () => this.tone(140, 0.15, 'sawtooth'),
    win: () => [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'sine', i * 0.1)),
    lose: () => {
      this.tone(220, 0.3, 'sawtooth');
      this.tone(180, 0.35, 'sawtooth', 0.15);
    },
    achievement: () => {
      this.tone(784, 0.1);
      this.tone(988, 0.16, 'sine', 0.1);
    },
    levelup: () => [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.15, 'sine', i * 0.08)),
  };

  play(name: SoundName): void {
    if (!this.storage.settings().sound) return;
    try {
      this.defs[name]();
    } catch {
      /* audio unavailable - ignore */
    }
  }
}
