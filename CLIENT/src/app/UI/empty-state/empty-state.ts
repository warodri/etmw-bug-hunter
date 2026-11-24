import { Component, Input } from '@angular/core';

/** A quiet placeholder that names the next action instead of only saying "nothing here". */
@Component({
  selector: 'app-empty-state',
  standalone: false,
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss'
})
export class EmptyState {
  @Input() icon = 'pi pi-inbox';
  @Input() title = 'Nothing here yet';
  @Input() message = '';
}
