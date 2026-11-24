import { Component, Input } from '@angular/core';

/** The heading every screen starts with, plus a slot on the right for its primary actions. */
@Component({
  selector: 'app-page-header',
  standalone: false,
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss'
})
export class PageHeader {
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() description = '';
}
