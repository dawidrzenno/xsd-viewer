import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnInit,
  QueryList,
  ViewChildren,
  signal,
} from '@angular/core';
import {
  loadHandbookCollapsedState,
  saveHandbookCollapsedState,
} from '../../../storage';
import type { HandbookSection } from './handbook-data';
import { PrismHighlightPipe } from '../../shared/pipes/prism-highlight.pipe';

@Component({
  selector: 'app-handbook-panel',
  standalone: true,
  imports: [CommonModule, PrismHighlightPipe],
  templateUrl: './handbook-panel.component.html',
  styleUrl: './handbook-panel.component.scss',
})
export class HandbookPanelComponent implements OnInit, AfterViewInit {
  @Input({ required: true }) handbookId = '';
  @Input({ required: true }) title = '';
  @Input({ required: true }) subtitle = '';
  @Input({ required: true }) sections: HandbookSection[] = [];

  @ViewChildren('cardElement') private readonly cardElements!: QueryList<ElementRef<HTMLElement>>;

  protected readonly isCollapsed = signal(false);
  protected renderedSections: HandbookSection[] = [];

  ngOnInit(): void {
    this.isCollapsed.set(loadHandbookCollapsedState(this.handbookId));
  }

  ngAfterViewInit(): void {
    this.renderedSections = this.sections.map((section) => ({
      ...section,
      cards: [...section.cards],
    }));

    queueMicrotask(() => this.sortCardsByHeight());
  }

  protected toggleCollapsed(): void {
    this.isCollapsed.update((value) => {
      const nextValue = !value;
      saveHandbookCollapsedState(this.handbookId, nextValue);
      return nextValue;
    });
  }

  private sortCardsByHeight(): void {
    const orderedHeights = this.cardElements.map((elementRef) => elementRef.nativeElement.offsetHeight);
    let cardIndex = 0;

    this.renderedSections = this.sections.map((section) => ({
      ...section,
      cards: section.cards
        .map((card) => {
          const height = orderedHeights[cardIndex] ?? 0;
          cardIndex += 1;
          return { card, height };
        })
        .sort((left, right) => left.height - right.height)
        .map(({ card }) => card),
    }));
  }
}
