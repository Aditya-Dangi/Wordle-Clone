import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { SetupComponent } from './features/setup/setup.component';
import { PlayComponent } from './features/play/play.component';
import { StatsComponent } from './features/stats/stats.component';
import { AchievementsComponent } from './features/achievements/achievements.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Wordle' },
  { path: 'setup/:mode', component: SetupComponent, title: 'Wordle - Setup' },
  { path: 'play', component: PlayComponent, title: 'Wordle - Play' },
  { path: 'stats', component: StatsComponent, title: 'Wordle - Stats' },
  { path: 'achievements', component: AchievementsComponent, title: 'Wordle - Achievements' },
  { path: 'settings', component: SettingsComponent, title: 'Wordle - Settings' },
  { path: '**', redirectTo: '' },
];
