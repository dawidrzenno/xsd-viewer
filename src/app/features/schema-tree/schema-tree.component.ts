import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import {
  loadSchemaFileCollapsedState,
  saveSchemaFileCollapsedState,
} from '../../../storage';
import type { ProcessedNode, SchemaFileInfo } from '../../../types';
import { PrismHighlightPipe } from '../../shared/pipes/prism-highlight.pipe';
import { SchemaTreeNodeComponent } from './schema-tree-node.component';

interface SchemaFileGroup {
  fileName: string;
  nodes: ProcessedNode[];
  schemaInfo: SchemaFileInfo | null;
  rawText: string;
}

@Component({
  selector: 'app-schema-tree',
  standalone: true,
  imports: [CommonModule, SchemaTreeNodeComponent, PrismHighlightPipe],
  templateUrl: './schema-tree.component.html',
  styleUrl: './schema-tree.component.scss',
})
export class SchemaTreeComponent implements OnInit {
  @Input({ required: true }) fileGroups: SchemaFileGroup[] = [];

  @Output() readonly fileRemove = new EventEmitter<string>();

  protected readonly collapsedFiles = signal<Record<string, boolean>>({});
  protected readonly fileExpandStates = signal<Record<string, boolean>>({});
  protected readonly treePaneWidth = signal(52);
  protected readonly wrapSourceLines = signal(true);
  private activeResizeAbortController: AbortController | null = null;

  ngOnInit(): void {
    this.collapsedFiles.set(loadSchemaFileCollapsedState());
  }

  protected isFileCollapsed(fileName: string): boolean {
    return this.collapsedFiles()[fileName];
  }

  protected toggleFile(fileName: string): void {
    const nextState = {
      ...this.collapsedFiles(),
      [fileName]: !this.collapsedFiles()[fileName],
    };
    this.collapsedFiles.set(nextState);
    saveSchemaFileCollapsedState(nextState);
  }

  protected onFileRemove(fileName: string): void {
    this.fileRemove.emit(fileName);
  }

  protected isFileExpanded(fileName: string): boolean {
    return this.fileExpandStates()[fileName] ?? true;
  }

  protected onExpandAll(fileName: string): void {
    this.fileExpandStates.set({
      ...this.fileExpandStates(),
      [fileName]: true,
    });
  }

  protected onCollapseAll(fileName: string): void {
    this.fileExpandStates.set({
      ...this.fileExpandStates(),
      [fileName]: false,
    });
  }

  protected toggleWrapSourceLines(): void {
    this.wrapSourceLines.update((value) => !value);
  }

  protected gridTemplateColumns(): string {
    const treeWidth = this.treePaneWidth();
    return `minmax(0, ${treeWidth}fr) 0.7rem minmax(0, ${100 - treeWidth}fr)`;
  }

  protected startResize(event: PointerEvent, container: HTMLElement): void {
    if (window.innerWidth <= 900) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.activeResizeAbortController?.abort();
    const abortController = new AbortController();
    this.activeResizeAbortController = abortController;

    const updateWidth = (clientX: number): void => {
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0) {
        return;
      }

      const relativeX = clientX - bounds.left;
      const widthPercent = (relativeX / bounds.width) * 100;
      this.treePaneWidth.set(Math.min(75, Math.max(25, widthPercent)));
    };

    updateWidth(event.clientX);

    window.addEventListener(
      'pointermove',
      (moveEvent) => {
        updateWidth(moveEvent.clientX);
      },
      { signal: abortController.signal },
    );

    const stopResize = (): void => {
      abortController.abort();
      if (this.activeResizeAbortController === abortController) {
        this.activeResizeAbortController = null;
      }
    };

    window.addEventListener('pointerup', stopResize, { once: true, signal: abortController.signal });
    window.addEventListener('pointercancel', stopResize, { once: true, signal: abortController.signal });
  }
}
