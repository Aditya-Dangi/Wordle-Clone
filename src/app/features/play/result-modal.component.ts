import { Component, computed, inject } from '@angular/core';
import { GameService } from '../../core/services/game.service';
import { ModalComponent } from '../../shared/modal/modal.component';

@Component({
  selector: 'app-result-modal',
  imports: [ModalComponent],
  templateUrl: './result-modal.component.html',
})
export class ResultModalComponent {
  readonly game = inject(GameService);
  readonly result = this.game.result;
  readonly open = computed(() => !!this.result());

  continue(): void {
    this.game.dismissResult();
  }

  share(): void {
    this.game.shareResult();
  }
}
