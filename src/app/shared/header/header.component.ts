import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, computed, inject, signal, viewChild, viewChildren } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StorageService } from '../../core/services/storage.service';
import { ProgressionService } from '../../core/services/progression.service';
import { HowtoService } from '../../core/services/howto.service';

interface IndicatorRect {
  x: number;
  w: number;
  ready: boolean;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements AfterViewInit {
  private readonly storage = inject(StorageService);
  private readonly progression = inject(ProgressionService);
  private readonly howto = inject(HowtoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = this.storage.profile;
  readonly streaks = this.storage.streaks;
  readonly xpPercent = computed(() => {
    const p = this.profile();
    const toNext = this.progression.xpForLevel(p.level);
    return Math.min(100, Math.round((p.xp / toNext) * 100));
  });

  readonly scrolled = signal(false);

  readonly navItems = [
    { path: '/', label: 'Home' },
    { path: '/stats', label: 'Stats' },
    { path: '/achievements', label: 'Achievements' },
    { path: '/settings', label: 'Settings' },
  ];

  private readonly navList = viewChild<ElementRef<HTMLElement>>('navList');
  private readonly navLinks = viewChildren<ElementRef<HTMLAnchorElement>>('navLink');

  /** Single source of truth for which tab is active - derived directly from the
   * router URL rather than reading a CSS class applied by routerLinkActive, whose
   * own DOM update can land a tick later than ours and made the indicator lag by
   * one navigation. */
  private readonly currentUrl = signal(this.router.url);
  readonly activeIndex = computed(() => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    return this.navItems.findIndex((item, i) =>
      i === 0 ? url === '/' : url === item.path || url.startsWith(item.path + '/'),
    );
  });

  /** Sliding pill position/width behind the active nav tab - shared across all tabs
   * instead of each tab owning its own appear/disappear background. */
  readonly indicator = signal<IndicatorRect>({ x: 0, w: 0, ready: false });

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.currentUrl.set(e.urlAfterRedirects);
        this.updateIndicator();
      }
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.updateIndicator());
    const list = this.navList()?.nativeElement;
    if (list && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.updateIndicator());
      ro.observe(list);
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  private updateIndicator(): void {
    const idx = this.activeIndex();
    const link = this.navLinks()[idx];
    if (idx < 0 || !link) {
      this.indicator.update((v) => ({ ...v, ready: false }));
      return;
    }
    const el = link.nativeElement;
    this.indicator.set({ x: el.offsetLeft, w: el.offsetWidth, ready: true });
  }

  openHowto(): void {
    this.howto.show();
  }
}
