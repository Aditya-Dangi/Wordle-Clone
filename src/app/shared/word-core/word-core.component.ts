import { Component, inject, input } from '@angular/core';
import { MotionService } from '../../core/services/motion.service';

export type WordCoreState = 'idle' | 'active' | 'success';

const FACE_LETTERS = ['W', 'O', 'R', 'D', 'L', 'E'];

@Component({
  selector: 'app-word-core',
  templateUrl: './word-core.component.html',
  styleUrl: './word-core.component.scss',
  host: { class: 'word-core-host' },
})
export class WordCoreComponent {
  readonly motion = inject(MotionService);
  readonly state = input<WordCoreState>('idle');

  readonly faces = FACE_LETTERS.map((letter, i) => ({ letter, index: i }));
}
