import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import { ALL_NODES_VALUE } from '../../../constants';
import { createEmptySchemaModel } from '../../../schema';
import type { ExampleXmlFileOption, SchemaModel } from '../../../types';
import {
  createChildDraftNode,
  createXmlComposerDraft,
  serializeXmlComposerDraft,
  type XmlComposerChildDefinition,
  type XmlComposerNodeDraft,
} from '../../../xml-composer';
import { ExampleJsonPanelComponent } from '../example-json-panel/example-json-panel.component';
import { PrismHighlightPipe } from '../../shared/pipes/prism-highlight.pipe';

@Component({
  selector: 'app-xml-composer-panel',
  standalone: true,
  imports: [CommonModule, PrismHighlightPipe, ExampleJsonPanelComponent],
  templateUrl: './xml-composer-panel.component.html',
  styleUrl: './xml-composer-panel.component.scss',
})
export class XmlComposerPanelComponent implements OnChanges {
  @Input({ required: true }) schemaModel: SchemaModel = createEmptySchemaModel();
  @Input({ required: true }) rootFileOptions: ExampleXmlFileOption[] = [];

  protected readonly isCollapsed = signal(false);
  protected readonly selectedFile = signal('');
  protected readonly draftRoot = signal<XmlComposerNodeDraft | null>(null);
  protected readonly targetNamespace = signal('');
  protected readonly previewXml = signal('');
  protected readonly nextId = signal(0);
  protected readonly fileOptionValue = ALL_NODES_VALUE;

  protected readonly emptyState =
    'Load one or more XSD files and choose a root element to compose XML from allowed schema elements.';

  ngOnChanges(_changes: SimpleChanges): void {
    this.syncSelections();
  }

  protected toggleCollapsed(): void {
    this.isCollapsed.update((value) => !value);
  }

  protected onFileChange(fileName: string): void {
    this.selectedFile.set(fileName);
    this.rebuildDraft();
  }

  protected addChild(parentNode: XmlComposerNodeDraft, childDefinition: XmlComposerChildDefinition): void {
    parentNode.children.push(
      createChildDraftNode(
        childDefinition,
        this.schemaModel,
        () => this.allocateId(),
        this.collectAncestorNames(parentNode),
      ),
    );
    this.refreshPreview();
  }

  protected removeNode(nodeId: string): void {
    const rootNode = this.draftRoot();
    if (!rootNode || rootNode.id === nodeId) {
      return;
    }

    this.removeNodeRecursive(rootNode, nodeId);
    this.refreshPreview();
  }

  protected updateAttribute(node: XmlComposerNodeDraft, attributeName: string, value: string): void {
    const attribute = node.attributes.find((entry) => entry.name === attributeName);
    if (!attribute) {
      return;
    }

    attribute.value = value;
    this.refreshPreview();
  }

  protected updateText(node: XmlComposerNodeDraft, value: string): void {
    node.text = value;
    this.refreshPreview();
  }

  protected availableChildren(node: XmlComposerNodeDraft): XmlComposerChildDefinition[] {
    return node.definition.children.filter((childDefinition) => {
      const currentCount = node.children.filter((child) => child.name === childDefinition.name).length;
      return childDefinition.maxOccurs === null || currentCount < childDefinition.maxOccurs;
    });
  }

  protected isRootNode(node: XmlComposerNodeDraft): boolean {
    return this.draftRoot()?.id === node.id;
  }

  protected shouldRenderNode(node: XmlComposerNodeDraft): boolean {
    return !node.isVirtualRoot;
  }

  protected async copyXml(): Promise<void> {
    if (!this.previewXml()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.previewXml());
    } catch (error) {
      console.error('Could not copy composed XML:', error);
    }
  }

  private syncSelections(): void {
    if (this.rootFileOptions.length === 0) {
      this.selectedFile.set('');
      this.draftRoot.set(null);
      this.targetNamespace.set('');
      this.previewXml.set('');
      return;
    }

    if (!this.rootFileOptions.some((option) => option.value === this.selectedFile())) {
      this.selectedFile.set(this.rootFileOptions[0].value);
    }
    this.rebuildDraft();
  }

  private rebuildDraft(): void {
    if (!this.selectedFile()) {
      this.draftRoot.set(null);
      this.targetNamespace.set('');
      this.previewXml.set('');
      return;
    }

    try {
      const draft = createXmlComposerDraft(
        this.fileOptionValue,
        this.schemaModel,
        this.selectedFile(),
        () => this.allocateId(),
      );
      this.draftRoot.set(draft.root);
      this.targetNamespace.set(draft.targetNamespace);
      this.previewXml.set(serializeXmlComposerDraft(draft.root, draft.targetNamespace));
    } catch (error) {
      console.error('Could not initialize XML composer:', error);
      this.draftRoot.set(null);
      this.targetNamespace.set('');
      this.previewXml.set(
        `Could not initialize XML composer: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private refreshPreview(): void {
    const rootNode = this.draftRoot();
    if (!rootNode) {
      this.previewXml.set('');
      return;
    }

    this.previewXml.set(serializeXmlComposerDraft(rootNode, this.targetNamespace()));
  }

  private allocateId(): string {
    const nextValue = this.nextId() + 1;
    this.nextId.set(nextValue);
    return `composer-node-${nextValue}`;
  }

  private removeNodeRecursive(parentNode: XmlComposerNodeDraft, nodeId: string): boolean {
    const childIndex = parentNode.children.findIndex((child) => child.id === nodeId);
    if (childIndex >= 0) {
      parentNode.children.splice(childIndex, 1);
      return true;
    }

    return parentNode.children.some((child) => this.removeNodeRecursive(child, nodeId));
  }

  private collectAncestorNames(node: XmlComposerNodeDraft): Set<string> {
    const names = new Set<string>();
    this.collectAncestorNamesRecursive(this.draftRoot(), node.id, [], names);
    return names;
  }

  private collectAncestorNamesRecursive(
    node: XmlComposerNodeDraft | null,
    targetId: string,
    path: string[],
    names: Set<string>,
  ): boolean {
    if (!node) {
      return false;
    }

    const nextPath = [...path, node.name];
    if (node.id === targetId) {
      nextPath.forEach((name) => names.add(name));
      return true;
    }

    return node.children.some((child) =>
      this.collectAncestorNamesRecursive(child, targetId, nextPath, names),
    );
  }
}
