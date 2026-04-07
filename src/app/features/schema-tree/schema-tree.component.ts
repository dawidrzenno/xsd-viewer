import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
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
export class SchemaTreeComponent {
  @Input({ required: true }) fileGroups: SchemaFileGroup[] = [];
  @Input({ required: true }) searchTerm = '';
  @Input({ required: true }) expandAll = true;
}
