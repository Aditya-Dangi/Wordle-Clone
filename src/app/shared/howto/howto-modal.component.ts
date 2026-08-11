import { Component, inject } from '@angular/core';
import { HowtoService } from '../../core/services/howto.service';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-howto-modal',
  imports: [ModalComponent],
  templateUrl: './howto-modal.component.html',
})
export class HowtoModalComponent {
  private readonly howto = inject(HowtoService);
  readonly open = this.howto.open;

  close(): void {
    this.howto.hide();
  }
}
