import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DashboardShell } from './LAYOUT/dashboard-shell/dashboard-shell';
import { ScreenDashboard } from './SCREEN/screen-dashboard/screen-dashboard';
import { ScreenDownload } from './SCREEN/screen-download/screen-download';
import { ScreenIssues } from './SCREEN/screen-issues/screen-issues';
import { ScreenLogin } from './SCREEN/screen-login/screen-login';
import { ScreenProjects } from './SCREEN/screen-projects/screen-projects';
import { ScreenScans } from './SCREEN/screen-scans/screen-scans';
import { ScreenSettings } from './SCREEN/screen-settings/screen-settings';
import { authGuard } from './SERVICES/auth.guard';

/**
 * Hash routing, like the other ETMW apps, so `/#/issues` works on any static host without a
 * rewrite rule. Login is outside the shell; every other route needs a session.
 */
const routes: Routes = [
  { path: 'login', component: ScreenLogin },
  {
    path: '',
    component: DashboardShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: ScreenDashboard, data: { title: 'Dashboard' } },
      { path: 'projects', component: ScreenProjects, data: { title: 'Projects' } },
      { path: 'scans', component: ScreenScans, data: { title: 'Scans' } },
      { path: 'issues', component: ScreenIssues, data: { title: 'Issues' } },
      { path: 'settings', component: ScreenSettings, data: { title: 'Settings' } },
      {
        path: 'download-windows',
        component: ScreenDownload,
        data: { title: 'Download agent', platform: 'windows' }
      },
      {
        path: 'download-mac',
        component: ScreenDownload,
        data: { title: 'Download agent', platform: 'mac' }
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { useHash: true, scrollPositionRestoration: 'top' })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
