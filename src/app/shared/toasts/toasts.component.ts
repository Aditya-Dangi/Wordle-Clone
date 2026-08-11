import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toasts',
  templateUrl: './toasts.component.html',
  styleUrl: './toasts.component.scss',
})
export class ToastsComponent {
  private readonly toast = inject(ToastService);
  readonly alerts = this.toast.alerts;
  readonly achievements = this.toast.achievements;
}
