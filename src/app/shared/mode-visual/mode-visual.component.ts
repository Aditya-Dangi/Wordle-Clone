import { Component, input } from '@angular/core';
import { ModeKey } from '../../core/models/game.models';

@Component({
  selector: 'app-mode-visual',
  templateUrl: './mode-visual.component.html',
  styleUrl: './mode-visual.component.scss',
  host: { class: 'mode-visual-host' },
})
export class ModeVisualComponent {
  readonly mode = input.required<ModeKey>();
  readonly icon = input<string>('');
  readonly boards = input(1);
}
