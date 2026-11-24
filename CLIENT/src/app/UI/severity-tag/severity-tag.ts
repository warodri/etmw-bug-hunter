import { Component, Input } from '@angular/core';

import { Severity } from '../../SERVICES/models/issue.models';

/** A severity pill. The colour scale lives once in `styles.scss` (`.sev--*`). */
@Component({
  selector: 'app-severity-tag',
  standalone: false,
  templateUrl: './severity-tag.html',
  styleUrl: './severity-tag.scss'
})
export class SeverityTag {
  @Input() severity: Severity | null = null;
  @Input() dot = true;
}
