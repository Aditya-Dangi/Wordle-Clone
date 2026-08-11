import { Component, input, output } from '@angular/core';
import { TileVM } from '../../core/services/game.service';

@Component({
  selector: 'app-board',
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent {
  readonly boards = input.required<TileVM[][][]>();
  readonly wordLength = input.required<number>();
  readonly maxGuesses = input.required<number>();
  readonly interactive = input(false);

  readonly tileClicked = output<{ board: number; row: number; col: number }>();

  onTileClick(board: number, row: number, col: number): void {
    if (!this.interactive()) return;
    this.tileClicked.emit({ board, row, col });
  }
}
