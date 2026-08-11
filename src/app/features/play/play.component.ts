import { Component, HostListener, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GameService, HINTS } from '../../core/services/game.service';
import { StorageService } from '../../core/services/storage.service';
import { ModesService } from '../../core/services/modes.service';
import { BoardComponent } from '../../shared/board/board.component';
import { KeyboardComponent } from '../../shared/keyboard/keyboard.component';
import { ResultModalComponent } from './result-modal.component';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

@Component({
  selector: 'app-play',
  imports: [BoardComponent, KeyboardComponent, ResultModalComponent],
  templateUrl: './play.component.html',
  styleUrl: './play.component.scss',
})
export class PlayComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  readonly game = inject(GameService);
  private readonly storage = inject(StorageService);
  private readonly modes = inject(ModesService);

  readonly session = this.game.session;
  readonly HINTS = HINTS;

  readonly modeName = computed(() => {
    const s = this.session();
    if (!s) return '';
    const category = s.category && s.category !== 'any' ? ` · ${capitalize(s.category)}` : '';
    return s.modeConfig.label + category;
  });

  readonly difficultyLabel = computed(() => {
    const s = this.session();
    if (!s) return '';
    if (s.difficulty === 'custom') return 'Custom';
    return this.modes.DIFFICULTIES[s.difficulty].label;
  });

  readonly coins = this.storage.profile;

  ngOnInit(): void {
    if (!this.session()) {
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy(): void {
    this.game.leaveSession();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    const s = this.session();
    if (!s || !s.active || s.locked || s.mode === 'reverse') return;
    if (this.game.result()) return;
    if (e.key === 'Enter') {
      this.game.submitGuess();
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      this.game.deleteKey();
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key)) {
      this.game.pressKey(e.key.toLowerCase());
    }
  }

  goBack(): void {
    this.game.leaveSession();
    this.router.navigate(['/']);
  }

  onGiveUp(): void {
    this.game.onGiveUp();
  }

  onRestart(): void {
    this.game.restart();
  }

  onTileClick(evt: { board: number; row: number; col: number }): void {
    this.game.cycleReverseTile(evt.row, evt.col);
  }

  onResultContinue(): void {
    this.game.dismissResult();
  }
}
