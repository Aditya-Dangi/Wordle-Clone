import { Component, input, output } from '@angular/core';

const ROW1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
const ROW2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
const ROW3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

@Component({
  selector: 'app-keyboard',
  templateUrl: './keyboard.component.html',
  styleUrl: './keyboard.component.scss',
})
export class KeyboardComponent {
  readonly keyRanks = input<Record<string, 0 | 1 | 2>>({});
  readonly disabled = input(false);

  readonly keyPress = output<string>();
  readonly enter = output<void>();
  readonly backspace = output<void>();

  readonly row1 = ROW1;
  readonly row2 = ROW2;
  readonly row3 = ROW3;

  stateFor(letter: string): 'absent' | 'present' | 'correct' | null {
    const rank = this.keyRanks()[letter];
    if (rank === undefined) return null;
    return rank === 2 ? 'correct' : rank === 1 ? 'present' : 'absent';
  }

  onKey(letter: string): void {
    if (this.disabled()) return;
    this.keyPress.emit(letter);
  }

  onEnter(): void {
    if (this.disabled()) return;
    this.enter.emit();
  }

  onBackspace(): void {
    if (this.disabled()) return;
    this.backspace.emit();
  }
}
