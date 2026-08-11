import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  body: string;
  onConfirm: () => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);

  ask(title: string, body: string, onConfirm: () => void): void {
    this.request.set({ title, body, onConfirm });
  }

  confirm(): void {
    const req = this.request();
    this.request.set(null);
    req?.onConfirm();
  }

  cancel(): void {
    this.request.set(null);
  }
}
