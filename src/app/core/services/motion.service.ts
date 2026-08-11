import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export interface NormalizedPointer {
  x: number;
  y: number;
}

/**
 * Central source of truth for ambient motion decisions: reduced-motion preference
 * (user setting OR OS-level), page visibility (to pause ambient loops when the tab
 * is hidden), and a throttled, viewport-normalized pointer position for background
 * parallax. Kept as one service so every 3D/ambient piece agrees on when to move.
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly storage = inject(StorageService);
  private readonly systemReducedMotion = signal(
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );

  readonly reducedMotion = computed(() => this.storage.settings().reducedMotion || this.systemReducedMotion());
  readonly pageVisible = signal(typeof document === 'undefined' || !document.hidden);
  readonly pointer = signal<NormalizedPointer>({ x: 0, y: 0 });

  private pointerRaf = 0;

  constructor() {
    if (typeof matchMedia === 'function') {
      matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => this.systemReducedMotion.set(e.matches));
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.pageVisible.set(!document.hidden));
      window.addEventListener(
        'pointermove',
        (e) => {
          if (this.pointerRaf) return;
          this.pointerRaf = requestAnimationFrame(() => {
            this.pointerRaf = 0;
            this.pointer.set({
              x: (e.clientX / window.innerWidth) * 2 - 1,
              y: (e.clientY / window.innerHeight) * 2 - 1,
            });
          });
        },
        { passive: true },
      );
    }
  }
}
