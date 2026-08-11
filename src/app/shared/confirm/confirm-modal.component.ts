import { Component, computed, inject } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-confirm-modal',
  imports: [ModalComponent],
  templateUrl: './confirm-modal.component.html',
})
export class ConfirmModalComponent {
  private readonly confirmSvc = inject(ConfirmService);
  readonly request = this.confirmSvc.request;
  readonly open = computed(() => !!this.request());

  confirm(): void {
    this.confirmSvc.confirm();
  }

  cancel(): void {
    this.confirmSvc.cancel();
  }
}
