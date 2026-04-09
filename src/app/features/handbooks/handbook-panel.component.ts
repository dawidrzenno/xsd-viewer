import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { HandbookSection } from './handbook-data';
import { PrismHighlightPipe } from '../../shared/pipes/prism-highlight.pipe';

@Component({
  selector: 'app-handbook-panel',
  standalone: true,
  imports: [CommonModule, PrismHighlightPipe],
  templateUrl: './handbook-panel.component.html',
  styleUrl: './handbook-panel.component.scss',
})
export class HandbookPanelComponent {
  @Input({ required: true }) handbookId = '';
  @Input({ required: true }) title = '';
  @Input({ required: true }) subtitle = '';
  @Input({ required: true }) sections: HandbookSection[] = [];
}
