import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { Summary } from './models/summary.models';

/** One request for the dashboard. */
@Injectable({ providedIn: 'root' })
export class SummaryService {
  private readonly api: ApiService;

  private readonly state = signal<Summary | null>(null);

  readonly summary = this.state.asReadonly();

  constructor(api: ApiService) {
    this.api = api;
  }

  async refresh(): Promise<void> {
    const response = await firstValueFrom(this.api.get<Summary>('/summary'));

    this.state.set(response);
  }
}
