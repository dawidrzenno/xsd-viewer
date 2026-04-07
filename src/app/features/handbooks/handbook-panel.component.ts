import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  QueryList,
  ViewChildren,
} from '@angular/core';
import type { HandbookSection } from './handbook-data';
import { PrismHighlightPipe } from '../../shared/pipes/prism-highlight.pipe';

@Component({
  selector: 'app-handbook-panel',
  standalone: true,
  imports: [CommonModule, PrismHighlightPipe],
  templateUrl: './handbook-panel.component.html',
  styleUrl: './handbook-panel.component.scss',
})
export class HandbookPanelComponent implements AfterViewInit {
  @Input({ required: true }) title = '';
  @Input({ required: true }) subtitle = '';
  @Input({ required: true }) sections: HandbookSection[] = [];

  @ViewChildren('cardElement') private readonly cardElements!: QueryList<ElementRef<HTMLElement>>;

  protected renderedSections: HandbookSection[] = [];

  ngAfterViewInit(): void {
    this.renderedSections = this.sections.map((section) => ({
      ...section,
      cards: [...section.cards],
    }));

    queueMicrotask(() => this.sortCardsByHeight());
  }

  private sortCardsByHeight(): void {
    const heightsByTitle = new Map<string, number>();

    this.cardElements.forEach((elementRef) => {
      const cardTitle = elementRef.nativeElement.dataset['cardTitle'];
      if (!cardTitle) {
        return;
      }

      heightsByTitle.set(cardTitle, elementRef.nativeElement.offsetHeight);
    });

    this.renderedSections = this.sections.map((section) => ({
      ...section,
      cards: [...section.cards].sort((left, right) => {
        const leftHeight = heightsByTitle.get(left.title) ?? 0;
        const rightHeight = heightsByTitle.get(right.title) ?? 0;
        return leftHeight - rightHeight;
      }),
    }));
  }
}
