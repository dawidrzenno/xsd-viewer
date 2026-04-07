import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import {
  loadSchemaFileCollapsedState,
  saveSchemaFileCollapsedState,
} from '../../../storage';
import type { ProcessedNode, SchemaFileInfo } from '../../../types';
import { SchemaTreeNodeComponent } from './schema-tree-node.component';

interface SchemaFileGroup {
  fileName: string;
  nodes: ProcessedNode[];
  schemaInfo: SchemaFileInfo | null;
}

@Component({
  selector: 'app-schema-tree',
  standalone: true,
  imports: [CommonModule, SchemaTreeNodeComponent],
  templateUrl: './schema-tree.component.html',
  styleUrl: './schema-tree.component.scss',
})
export class SchemaTreeComponent implements OnInit {
  @Input({ required: true }) fileGroups: SchemaFileGroup[] = [];
  @Input({ required: true }) selectedFileNames: string[] = [];

  @Output() readonly fileSelectionChange = new EventEmitter<{
    fileName: string;
    selected: boolean;
  }>();
  @Output() readonly fileRemove = new EventEmitter<string>();

  protected readonly collapsedFiles = signal<Record<string, boolean>>({});
  protected readonly fileSearchTerms = signal<Record<string, string>>({});
  protected readonly fileExpandStates = signal<Record<string, boolean>>({});

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

  protected isFileSelected(fileName: string): boolean {
    return this.selectedFileNames.includes(fileName);
  }

  protected onFileSelectionChange(fileName: string, selected: boolean): void {
    this.fileSelectionChange.emit({ fileName, selected });
  }

  protected onFileRemove(fileName: string): void {
    this.fileRemove.emit(fileName);
  }

  protected getFileSearchTerm(fileName: string): string {
    return this.fileSearchTerms()[fileName] ?? '';
  }

  protected onSearchInput(fileName: string, term: string): void {
    this.fileSearchTerms.set({
      ...this.fileSearchTerms(),
      [fileName]: term,
    });
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
}
