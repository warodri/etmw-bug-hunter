import { NgModule, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { PanelModule } from 'primeng/panel';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { providePrimeNG } from 'primeng/config';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { BugHunterPreset } from './app-theme';
import { ProjectForm } from './COMPONENTS/PROJECTS/project-form/project-form';
import { DashboardShell } from './LAYOUT/dashboard-shell/dashboard-shell';
import { SidebarNav } from './LAYOUT/sidebar-nav/sidebar-nav';
import { ScreenDashboard } from './SCREEN/screen-dashboard/screen-dashboard';
import { ScreenDownload } from './SCREEN/screen-download/screen-download';
import { ScreenIssues } from './SCREEN/screen-issues/screen-issues';
import { ScreenLogin } from './SCREEN/screen-login/screen-login';
import { ScreenProjects } from './SCREEN/screen-projects/screen-projects';
import { ScreenScans } from './SCREEN/screen-scans/screen-scans';
import { ScreenSettings } from './SCREEN/screen-settings/screen-settings';
import { authInterceptor } from './SERVICES/auth.interceptor';
import { EmptyState } from './UI/empty-state/empty-state';
import { PageHeader } from './UI/page-header/page-header';
import { SeverityTag } from './UI/severity-tag/severity-tag';

@NgModule({
  declarations: [
    App,
    DashboardShell,
    SidebarNav,
    ScreenDashboard,
    ScreenProjects,
    ScreenScans,
    ScreenIssues,
    ScreenSettings,
    ScreenLogin,
    ScreenDownload,
    ProjectForm,
    PageHeader,
    SeverityTag,
    EmptyState
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    CheckboxModule,
    MenuModule,
    TagModule,
    PanelModule,
    ProgressBarModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    ToggleSwitchModule
  ],
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([authInterceptor])),
    providePrimeNG({
      theme: {
        preset: BugHunterPreset,
        options: { darkModeSelector: false, cssLayer: false }
      }
    }),
    MessageService,
    ConfirmationService
  ],
  bootstrap: [App]
})
export class AppModule {}
