import { Injectable, signal } from '@angular/core';

export interface AlertToast {
  id: number;
  message: string;
  hiding: boolean;
}

export interface AchievementToast {
  id: number;
  name: string;
  icon: string;
}

let nextId = 1;

/** Transient alert banners (top-center) and achievement-unlock toasts (bottom-right). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly alerts = signal<AlertToast[]>([]);
  readonly achievements = signal<AchievementToast[]>([]);

  showAlert(message: string, duration = 1200): void {
    const id = nextId++;
    this.alerts.update((list) => [{ id, message, hiding: false }, ...list]);
    if (duration == null) return;
    setTimeout(() => {
      this.alerts.update((list) => list.map((a) => (a.id === id ? { ...a, hiding: true } : a)));
      setTimeout(() => {
        this.alerts.update((list) => list.filter((a) => a.id !== id));
      }, 400);
    }, duration);
  }

  showAchievement(achievement: { name: string; icon: string }): void {
    const id = nextId++;
    this.achievements.update((list) => [...list, { id, name: achievement.name, icon: achievement.icon }]);
    setTimeout(() => {
      this.achievements.update((list) => list.filter((a) => a.id !== id));
    }, 4200);
  }
}
