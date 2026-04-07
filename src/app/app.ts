import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { VIRTUAL_ROOT_VALUE } from '../constants';
import {
  buildSchemaModel,
  parseCachedFiles,
  processXsdDocs,
  readFiles,
} from '../schema';
import {
  loadCachedFiles,
  loadSelectedRoot,
  saveCachedFiles,
  saveSelectedRoot,
} from '../storage';
import type { CachedFileEntry, ProcessedNode, SchemaModel } from '../types';
import { generateExampleXml } from '../xml-generator';
import { ExampleXmlPanelComponent } from './features/example-xml-panel/example-xml-panel.component';
import { SchemaTreeComponent } from './features/schema-tree/schema-tree.component';
import { XmlHandbookComponent } from './features/handbooks/xml-handbook.component';
import { XsdHandbookComponent } from './features/handbooks/xsd-handbook.component';

interface SchemaFileGroup {
  fileName: string;
  nodes: ProcessedNode[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ExampleXmlPanelComponent,
    SchemaTreeComponent,
    XmlHandbookComponent,
    XsdHandbookComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly searchTerm = signal('');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly fileNames = signal<string[]>([]);
  protected readonly processedNodes = signal<ProcessedNode[]>([]);
  protected readonly schemaModel = signal<SchemaModel>(buildSchemaModel([]));
  protected readonly selectedRoot = signal('');
  protected readonly exampleXml = signal('');
  protected readonly expandAll = signal(true);

  protected readonly rootOptions = computed(() => {
    const rootNames = Array.from(this.schemaModel().elements.keys()).sort((a, b) =>
      a.localeCompare(b),
    );

    if (rootNames.length === 0) {
      return [];
    }

    return [
      { value: VIRTUAL_ROOT_VALUE, label: 'Virtual root (all top-level elements)' },
      ...rootNames.map((name) => ({ value: name, label: name })),
    ];
  });

  protected readonly fileGroups = computed<SchemaFileGroup[]>(() => {
    const groups = this.processedNodes().reduce<Map<string, ProcessedNode[]>>((acc, node) => {
      const fileName = node.fileName || 'Unknown File';
      const fileNodes = acc.get(fileName) ?? [];
      fileNodes.push(node);
      acc.set(fileName, fileNodes);
      return acc;
    }, new Map());

    return Array.from(groups.entries()).map(([fileName, nodes]) => ({
      fileName,
      nodes,
    }));
  });

  constructor() {
    void this.restoreCachedFiles();
  }

  protected async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (!files || files.length === 0) {
      return;
    }

    const fileEntries = await readFiles(files);
    await this.parseCachedEntries(fileEntries, true);
  }

  protected onSearchInput(term: string): void {
    this.searchTerm.set(term);
  }

  protected onExpandAll(): void {
    this.expandAll.set(true);
  }

  protected onCollapseAll(): void {
    this.expandAll.set(false);
  }

  protected onRootSelectionChange(rootName: string): void {
    this.selectedRoot.set(rootName);
    this.generateExampleXmlForRoot(rootName);
  }

  private async restoreCachedFiles(): Promise<void> {
    const cachedFiles = loadCachedFiles();

    if (cachedFiles.length === 0) {
      this.fileNames.set([]);
      return;
    }

    await this.parseCachedEntries(cachedFiles, false);
  }

  private async parseCachedEntries(
    fileEntries: CachedFileEntry[],
    persistToCache: boolean,
  ): Promise<void> {
    try {
      this.isLoading.set(true);
      this.errorMessage.set('');

      const xsdDocs = parseCachedFiles(fileEntries);

      if (persistToCache) {
        saveCachedFiles(fileEntries);
      }

      const schemaModel = buildSchemaModel(xsdDocs);
      const processedNodes = processXsdDocs(xsdDocs);

      this.schemaModel.set(schemaModel);
      this.processedNodes.set(processedNodes);
      this.fileNames.set(fileEntries.map((file) => file.name));
      this.expandAll.set(true);

      const initialRoot = this.resolveInitialRoot(schemaModel);
      this.selectedRoot.set(initialRoot);
      this.generateExampleXmlForRoot(initialRoot);
    } catch (error) {
      console.error('Error parsing files:', error);
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Could not parse XSD files',
      );
      this.processedNodes.set([]);
      this.schemaModel.set(buildSchemaModel([]));
      this.selectedRoot.set('');
      this.exampleXml.set('');
    } finally {
      this.isLoading.set(false);
    }
  }

  private resolveInitialRoot(schemaModel: SchemaModel): string {
    const rootNames = Array.from(schemaModel.elements.keys()).sort((a, b) =>
      a.localeCompare(b),
    );

    if (rootNames.length === 0) {
      return '';
    }

    const savedRoot = loadSelectedRoot();
    const availableValues = new Set([VIRTUAL_ROOT_VALUE, ...rootNames]);
    if (savedRoot && availableValues.has(savedRoot)) {
      saveSelectedRoot(savedRoot);
      return savedRoot;
    }

    const nextRoot = rootNames.length === 1 ? rootNames[0] : VIRTUAL_ROOT_VALUE;
    saveSelectedRoot(nextRoot);
    return nextRoot;
  }

  private generateExampleXmlForRoot(rootName: string): void {
    if (!rootName) {
      this.exampleXml.set('');
      return;
    }

    try {
      saveSelectedRoot(rootName);
      this.exampleXml.set(generateExampleXml(rootName, this.schemaModel()));
    } catch (error) {
      console.error('Could not generate example XML:', error);
      this.exampleXml.set(
        `Could not generate example XML: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
