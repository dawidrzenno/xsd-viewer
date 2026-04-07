import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, computed, signal } from '@angular/core';
import type { ProcessedNode } from '../../../types';

@Component({
  selector: 'app-schema-tree-node',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './schema-tree-node.component.html',
  styleUrl: './schema-tree-node.component.scss',
})
export class SchemaTreeNodeComponent implements OnChanges {
  @Input({ required: true }) node!: ProcessedNode;
  @Input() searchTerm = '';
  @Input() expandAll = true;
  @Input() depth = 0;

  protected readonly isExpanded = signal(true);

  protected readonly restrictionsText = computed(() => {
    const restrictions = this.node.restrictions;
    if (!restrictions) {
      return '';
    }

    return Object.entries(restrictions)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
  });

  protected readonly attributesText = computed(() => {
    const attributes = this.node.attributes;
    if (!attributes?.length) {
      return '';
    }

    return attributes
      .map((attribute) => `${attribute.name}${attribute.use === 'required' ? '*' : ''}`)
      .join(', ');
  });

  protected readonly metadataText = computed(() => {
    const metadata: string[] = [];

    if (this.node.fileName) {
      metadata.push(`File: ${this.node.fileName}`);
    }
    if (this.node.minOccurs) {
      metadata.push(`Min: ${this.node.minOccurs}`);
    }
    if (this.node.maxOccurs) {
      metadata.push(`Max: ${this.node.maxOccurs}`);
    }

    return metadata.join(' | ');
  });

  protected readonly isVisible = computed(() =>
    this.nodeMatches(this.node, this.searchTerm.trim().toLowerCase()),
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expandAll']) {
      this.isExpanded.set(this.expandAll);
    }
  }

  protected toggleExpanded(): void {
    this.isExpanded.update((value) => !value);
  }

  private nodeMatches(node: ProcessedNode, term: string): boolean {
    if (!term) {
      return true;
    }

    const haystacks = [
      node.name,
      node.type,
      node.documentation,
      node.fileName ?? '',
      this.metadataText(),
      this.attributesText(),
    ];

    if (haystacks.some((value) => value.toLowerCase().includes(term))) {
      return true;
    }

    return node.children.some((child) => this.nodeMatches(child, term));
  }
}
