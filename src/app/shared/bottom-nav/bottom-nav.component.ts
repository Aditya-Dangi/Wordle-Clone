import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';
import { GameService } from '../../core/services/game.service';

/** Mobile-only bottom tab bar. Play is a primary action, not a route: it starts (or
 * resumes) today's Daily Challenge directly, mirroring the hero's main CTA. */
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly game = inject(GameService);

  readonly daily = this.storage.daily;

  constructor() {
    this.storage.getDaily();
  }

  play(): void {
    if (!this.daily().completed) {
      this.game.startSession('daily', this.game.defaultSelectionsFor());
      this.router.navigate(['/play']);
      return;
    }
    this.router.navigate(['/']);
  }
}
