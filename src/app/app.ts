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
  loadExampleXmlCommentOptions,
  loadSelectedRoot,
  saveCachedFiles,
  saveExampleXmlCommentOptions,
  saveSelectedRoot,
} from '../storage';
import type {
  CachedFileEntry,
  ExampleXmlCommentOptions,
  ProcessedNode,
  SchemaModel,
} from '../types';
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
  private readonly defaultCommentOptions: ExampleXmlCommentOptions = {
    elementNames: true,
    documentation: true,
    occurrences: true,
    declaredTypes: true,
    resolvedTypes: true,
    attributes: true,
    restrictions: true,
  };

  protected readonly searchTerm = signal('');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly cachedFiles = signal<CachedFileEntry[]>([]);
  protected readonly fileNames = signal<string[]>([]);
  protected readonly selectedFileNames = signal<string[]>([]);
  protected readonly processedNodes = signal<ProcessedNode[]>([]);
  protected readonly schemaModel = signal<SchemaModel>(buildSchemaModel([]));
  protected readonly selectedRoot = signal('');
  protected readonly exampleXml = signal('');
  protected readonly expandAll = signal(true);
  protected readonly commentOptions = signal<ExampleXmlCommentOptions>(
    loadExampleXmlCommentOptions(this.defaultCommentOptions),
  );

  protected readonly rootOptions = computed(() => {
    const rootNames = Array.from(this.schemaModel().elements.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, entry]) => ({
        value: name,
        label: `${name} (${entry.fileName})`,
      }));

    if (rootNames.length === 0) {
      return [];
    }

    const virtualRoots = this.cachedFileNames()
      .filter((fileName) =>
        Array.from(this.schemaModel().elements.values()).some(
          (entry) => entry.fileName === fileName,
        ),
      )
      .map((fileName) => ({
        value: `${VIRTUAL_ROOT_VALUE}:${fileName}`,
        label: `Virtual root (${fileName})`,
      }));

    return [...virtualRoots, ...rootNames];
  });

  protected readonly fileGroups = computed<SchemaFileGroup[]>(() => {
    const groups = this.processedNodes().reduce<Map<string, ProcessedNode[]>>((acc, node) => {
      const fileName = node.fileName || 'Unknown File';
      const fileNodes = acc.get(fileName) ?? [];
      fileNodes.push(node);
      acc.set(fileName, fileNodes);
      return acc;
    }, new Map());

    return this.cachedFileNames().map((fileName) => ({
      fileName,
      nodes: groups.get(fileName) ?? [],
    }));
  });

  protected readonly cachedFileNames = computed(() =>
    this.fileNames()
      .slice()
      .sort((left, right) => left.localeCompare(right)),
  );

  constructor() {
    void this.restoreCachedFiles();
  }

  protected async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (!files || files.length === 0) {
      return;
    }

    const nextEntries = await readFiles(files);
    if (nextEntries.length === 0) {
      return;
    }

    const mergedEntries = this.mergeCachedEntries(this.cachedFiles(), nextEntries);
    const selectedNames = new Set(this.selectedFileNames());
    nextEntries.forEach((file) => selectedNames.add(file.name));

    this.cachedFiles.set(mergedEntries);
    this.fileNames.set(mergedEntries.map((file) => file.name));
    this.selectedFileNames.set(Array.from(selectedNames));
    saveCachedFiles(mergedEntries);
    await this.applySelection();

    input.value = '';
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

  protected onCommentOptionChange(change: {
    key: keyof ExampleXmlCommentOptions;
    checked: boolean;
  }): void {
    const nextOptions = {
      ...this.commentOptions(),
      [change.key]: change.checked,
    };
    this.commentOptions.set(nextOptions);
    saveExampleXmlCommentOptions(nextOptions);
    this.generateExampleXmlForRoot(this.selectedRoot());
  }

  protected onCommentOptionsBulkChange(checked: boolean): void {
    const nextOptions: ExampleXmlCommentOptions = {
      elementNames: checked,
      documentation: checked,
      occurrences: checked,
      declaredTypes: checked,
      resolvedTypes: checked,
      attributes: checked,
      restrictions: checked,
    };
    this.commentOptions.set(nextOptions);
    saveExampleXmlCommentOptions(nextOptions);
    this.generateExampleXmlForRoot(this.selectedRoot());
  }

  protected isFileSelected(fileName: string): boolean {
    return this.selectedFileNames().includes(fileName);
  }

  protected async onFileSelectionChange(change: {
    fileName: string;
    selected: boolean;
  }): Promise<void> {
    const nextSelected = change.selected
      ? Array.from(new Set([...this.selectedFileNames(), change.fileName]))
      : this.selectedFileNames().filter((fileName) => fileName !== change.fileName);

    this.selectedFileNames.set(nextSelected);
    await this.applySelection();
  }

  protected async onClearFileSelection(): Promise<void> {
    this.selectedFileNames.set([]);
    await this.applySelection();
  }

  protected async onRemoveFile(fileName: string): Promise<void> {
    const nextCachedFiles = this.cachedFiles().filter((file) => file.name !== fileName);
    this.cachedFiles.set(nextCachedFiles);
    this.fileNames.set(nextCachedFiles.map((file) => file.name));
    this.selectedFileNames.set(
      this.selectedFileNames().filter((selectedFileName) => selectedFileName !== fileName),
    );
    saveCachedFiles(nextCachedFiles);
    await this.applySelection();
  }

  private async restoreCachedFiles(): Promise<void> {
    const cachedFiles = loadCachedFiles();
    this.cachedFiles.set(cachedFiles);
    this.fileNames.set(cachedFiles.map((file) => file.name));

    if (cachedFiles.length === 0) {
      this.selectedFileNames.set([]);
      return;
    }

    this.selectedFileNames.set(cachedFiles.map((file) => file.name));
    await this.applySelection();
  }

  private async applySelection(): Promise<void> {
    const selectedEntries = this.cachedFiles().filter((file) =>
      this.selectedFileNames().includes(file.name),
    );

    if (selectedEntries.length === 0) {
      this.errorMessage.set('');
      this.processedNodes.set([]);
      this.schemaModel.set(buildSchemaModel([]));
      this.selectedRoot.set('');
      this.exampleXml.set('');
      return;
    }

    try {
      this.isLoading.set(true);
      this.errorMessage.set('');

      const xsdDocs = parseCachedFiles(selectedEntries);

      const schemaModel = buildSchemaModel(xsdDocs);
      const processedNodes = processXsdDocs(xsdDocs);

      this.schemaModel.set(schemaModel);
      this.processedNodes.set(processedNodes);
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

  private mergeCachedEntries(
    currentEntries: CachedFileEntry[],
    nextEntries: CachedFileEntry[],
  ): CachedFileEntry[] {
    const entriesByName = new Map(currentEntries.map((file) => [file.name, file]));
    nextEntries.forEach((file) => {
      entriesByName.set(file.name, file);
    });
    return Array.from(entriesByName.values());
  }

  private resolveInitialRoot(schemaModel: SchemaModel): string {
    const rootNames = Array.from(schemaModel.elements.keys()).sort((a, b) =>
      a.localeCompare(b),
    );
    const virtualRootNames = this.cachedFileNames()
      .filter((fileName) =>
        Array.from(schemaModel.elements.values()).some((entry) => entry.fileName === fileName),
      )
      .map((fileName) => `${VIRTUAL_ROOT_VALUE}:${fileName}`);
    const availableValues = new Set([...virtualRootNames, ...rootNames]);

    if (availableValues.size === 0) {
      return '';
    }

    const savedRoot = loadSelectedRoot();
    if (savedRoot && availableValues.has(savedRoot)) {
      saveSelectedRoot(savedRoot);
      return savedRoot;
    }

    const nextRoot =
      virtualRootNames[0] ||
      rootNames[0] ||
      '';
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
      this.exampleXml.set(
        generateExampleXml(rootName, this.schemaModel(), this.commentOptions()),
      );
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
