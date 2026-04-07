import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { ALL_NODES_VALUE } from '../../../constants';
import { PrismHighlightPipe } from '../../shared/pipes/prism-highlight.pipe';
import type {
  ExampleXmlCommentOptions,
  ExampleXmlFileOption,
} from '../../../types';
import {
  loadHandbookCollapsedState,
  saveHandbookCollapsedState,
} from '../../../storage';

interface RootOption {
  value: string;
  label: string;
}

interface CommentOptionGroup {
  title: string;
  options: Array<{
    key: keyof ExampleXmlCommentOptions;
    label: string;
  }>;
}

@Component({
  selector: 'app-example-xml-panel',
  standalone: true,
  imports: [CommonModule, PrismHighlightPipe],
  templateUrl: './example-xml-panel.component.html',
  styleUrl: './example-xml-panel.component.scss',
})
export class ExampleXmlPanelComponent implements OnInit {
  @ViewChild('outputContent') private outputContent?: ElementRef<HTMLElement>;
  protected readonly allNodesValue = ALL_NODES_VALUE;

  @Input({ required: true }) rootFileOptions: ExampleXmlFileOption[] = [];
  @Input({ required: true }) selectedRootFile = '';
  @Input({ required: true }) rootOptions: RootOption[] = [];
  @Input({ required: true }) selectedRoot = '';
  @Input({ required: true }) exampleXml = '';
  @Input({ required: true }) commentOptions!: ExampleXmlCommentOptions;

  @Output() readonly selectedRootFileChange = new EventEmitter<string>();
  @Output() readonly selectedRootChange = new EventEmitter<string>();
  @Output() readonly commentOptionChange = new EventEmitter<{
    key: keyof ExampleXmlCommentOptions;
    checked: boolean;
  }>();
  @Output() readonly commentOptionsBulkChange = new EventEmitter<boolean>();

  protected readonly isCollapsed = signal(false);
  protected readonly outputHeight = signal(0);
  protected readonly commentOptionGroups: CommentOptionGroup[] = [
    {
      title: 'Element metadata',
      options: [
        { key: 'elementNames', label: 'Element labels' },
        { key: 'documentation', label: 'Documentation' },
        { key: 'occurrences', label: 'Occurrences' },
      ],
    },
    {
      title: 'Type metadata',
      options: [
        { key: 'declaredTypes', label: 'Declared types' },
        { key: 'resolvedTypes', label: 'Resolved types' },
        { key: 'restrictions', label: 'Restrictions' },
      ],
    },
    {
      title: 'Attribute metadata',
      options: [{ key: 'attributes', label: 'Attributes' }],
    },
  ];

  protected readonly emptyState = 'Load one or more XSD files to generate example XML.';
  private resizeObserver: ResizeObserver | null = null;

  ngOnInit(): void {
    this.isCollapsed.set(loadHandbookCollapsedState('example-xml'));
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
      saveHandbookCollapsedState('example-xml', nextValue);
      return nextValue;
    });
  }

  protected onRootFileChange(fileName: string): void {
    this.selectedRootFileChange.emit(fileName);
  }

  protected onRootChange(rootName: string): void {
    this.selectedRootChange.emit(rootName);
  }

  protected onCommentOptionChange(
    key: keyof ExampleXmlCommentOptions,
    checked: boolean
  ): void {
    this.commentOptionChange.emit({ key, checked });
  }

  protected setAllCommentOptions(checked: boolean): void {
    this.commentOptionsBulkChange.emit(checked);
  }

  protected get previewXml(): string {
    return this.exampleXml.replace(/^\s*<\?xml[^?]*\?>\s*/i, '');
  }

  protected async copyXml(): Promise<void> {
    if (!this.exampleXml) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.exampleXml);
    } catch (error) {
      console.error('Could not copy XML:', error);
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
