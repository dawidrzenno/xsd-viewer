import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import {
  loadSchemaFileCollapsedState,
  saveSchemaFileCollapsedState,
} from '../../../storage';
import type { ProcessedNode } from '../../../types';
import { SchemaTreeNodeComponent } from './schema-tree-node.component';

interface SchemaFileGroup {
  fileName: string;
  nodes: ProcessedNode[];
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
  @Input({ required: true }) searchTerm = '';
  @Input({ required: true }) expandAll = true;

  protected readonly collapsedFiles = signal<Record<string, boolean>>({});

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
}
