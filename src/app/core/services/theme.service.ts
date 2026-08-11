import { Injectable, effect, inject } from '@angular/core';
import { StorageService } from './storage.service';

/** Applies theme/accessibility settings to the document root and keeps them in sync reactively. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(StorageService);

  constructor() {
    effect(() => {
      const settings = this.storage.settings();
      const root = document.documentElement;
      root.setAttribute('data-theme', settings.theme);
      root.setAttribute('data-color-blind', String(settings.colorBlind));
      root.setAttribute('data-high-contrast', String(settings.highContrast));
      root.setAttribute('data-reduced-motion', String(settings.reducedMotion));
    });
  }
}
