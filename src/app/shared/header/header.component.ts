import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';
import { ProgressionService } from '../../core/services/progression.service';
import { HowtoService } from '../../core/services/howto.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private readonly storage = inject(StorageService);
  private readonly progression = inject(ProgressionService);
  private readonly howto = inject(HowtoService);

  readonly profile = this.storage.profile;
  readonly streaks = this.storage.streaks;
  readonly xpPercent = computed(() => {
    const p = this.profile();
    const toNext = this.progression.xpForLevel(p.level);
    return Math.min(100, Math.round((p.xp / toNext) * 100));
  });

  readonly scrolled = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  openHowto(): void {
    this.howto.show();
  }
}
