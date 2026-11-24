import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs';

import { AuthService } from '../../SERVICES/auth.service';

/**
 * The dashboard chrome: rail on the left, top bar, routed content on the right.
 *
 * It owns the two shell details every screen would repeat: the current route's title and the
 * mobile drawer. A route change closes the drawer.
 */
@Component({
  selector: 'app-dashboard-shell',
  standalone: false,
  templateUrl: './dashboard-shell.html',
  styleUrl: './dashboard-shell.scss'
})
export class DashboardShell {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleSignal = signal('Dashboard');

  readonly pageTitle = this.titleSignal.asReadonly();
  readonly navOpen = signal(false);
  readonly user = this.auth.user;

  readonly downloadItems: MenuItem[] = [
    {
      label: 'Windows agent',
      icon: 'pi pi-microsoft',
      routerLink: ['/download-windows']
    },
    {
      label: 'Mac agent',
      icon: 'pi pi-apple',
      routerLink: ['/download-mac']
    }
  ];

  constructor() {
    this.syncTitle();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.syncTitle();
        this.navOpen.set(false);
      });
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  private syncTitle(): void {
    let route = this.router.routerState.snapshot.root;

    while (route.firstChild) {
      route = route.firstChild;
    }

    const title = route.data['title'];

    this.titleSignal.set(typeof title === 'string' && title ? title : 'Dashboard');
  }
}
