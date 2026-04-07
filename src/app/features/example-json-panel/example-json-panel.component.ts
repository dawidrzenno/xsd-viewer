import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { loadHandbookCollapsedState, saveHandbookCollapsedState } from '../../../storage';
import { convertXmlToJson } from '../../../xml-to-json';
import { PrismHighlightPipe } from '../../shared/pipes/prism-highlight.pipe';

@Component({
  selector: 'app-example-json-panel',
  standalone: true,
  imports: [CommonModule, PrismHighlightPipe],
  templateUrl: './example-json-panel.component.html',
  styleUrl: './example-json-panel.component.scss',
})
export class ExampleJsonPanelComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('outputContent') private outputContent?: ElementRef<HTMLElement>;

  @Input({ required: true }) exampleXml = '';

  protected readonly isCollapsed = signal(false);
  protected readonly outputHeight = signal(0);
  protected readonly emptyState = 'Generate example XML to convert it into JSON.';
  private resizeObserver: ResizeObserver | null = null;

  ngOnInit(): void {
    this.isCollapsed.set(loadHandbookCollapsedState('example-json'));
  }

  ngAfterViewInit(): void {
    this.initializeOutputResizeObserver();
    this.syncOutputHeight();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  protected toggleCollapsed(): void {
    this.isCollapsed.update((value) => {
      const nextValue = !value;
      saveHandbookCollapsedState('example-json', nextValue);
      return nextValue;
    });
  }

  protected get previewJson(): string {
    if (!this.exampleXml) {
      return '';
    }

    try {
      return convertXmlToJson(this.exampleXml);
    } catch (error) {
      return `Could not convert XML to JSON: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
    }
  }

  protected async copyJson(): Promise<void> {
    if (!this.previewJson) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.previewJson);
    } catch (error) {
      console.error('Could not copy JSON:', error);
    }
  }

  private initializeOutputResizeObserver(): void {
    const element = this.outputContent?.nativeElement;
    if (!element) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.syncOutputHeight();
    });
    this.resizeObserver.observe(element);
  }

  private syncOutputHeight(): void {
    requestAnimationFrame(() => {
      const element = this.outputContent?.nativeElement;
      if (!element) {
        return;
      }

      this.outputHeight.set(element.scrollHeight);
    });
  }
}
