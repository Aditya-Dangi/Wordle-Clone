import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header.component';
import { BottomNavComponent } from './shared/bottom-nav/bottom-nav.component';
import { ToastsComponent } from './shared/toasts/toasts.component';
import { ConfirmModalComponent } from './shared/confirm/confirm-modal.component';
import { HowtoModalComponent } from './shared/howto/howto-modal.component';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, BottomNavComponent, ToastsComponent, ConfirmModalComponent, HowtoModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly theme = inject(ThemeService);
}
