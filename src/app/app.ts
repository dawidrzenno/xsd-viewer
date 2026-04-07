import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { ALL_NODES_VALUE } from '../constants';
import {
  buildSchemaModel,
  extractSchemaFileInfo,
  parseCachedFiles,
  processXsdDocs,
  readFiles,
} from '../schema';
import {
  loadCachedFiles,
  loadExampleXmlGenerationMode,
  loadSelectedRoot,
  loadSelectedRootFile,
  saveCachedFiles,
  saveExampleXmlGenerationMode,
  saveSelectedRoot,
  saveSelectedRootFile,
} from '../storage';
import type {
  CachedFileEntry,
  ExampleXmlFileOption,
  ExampleXmlGenerationMode,
  ProcessedNode,
  SchemaFileInfo,
  SchemaModel,
} from '../types';
import { generateExampleXml } from '../xml-generator';
import { ExampleXmlPanelComponent } from './features/example-xml-panel/example-xml-panel.component';
import { ExampleJsonPanelComponent } from './features/example-json-panel/example-json-panel.component';
import { SchemaTreeComponent } from './features/schema-tree/schema-tree.component';
import { XmlHandbookComponent } from './features/handbooks/xml-handbook.component';
import { XsdHandbookComponent } from './features/handbooks/xsd-handbook.component';

interface SchemaFileGroup {
  fileName: string;
  nodes: ProcessedNode[];
  schemaInfo: SchemaFileInfo | null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ExampleXmlPanelComponent,
    ExampleJsonPanelComponent,
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
  protected readonly cachedFiles = signal<CachedFileEntry[]>([]);
  protected readonly fileNames = signal<string[]>([]);
  protected readonly processedNodes = signal<ProcessedNode[]>([]);
  protected readonly schemaModel = signal<SchemaModel>(buildSchemaModel([]));
  protected readonly selectedRootFile = signal('');
  protected readonly selectedRoot = signal('');
  protected readonly exampleXml = signal('');
  protected readonly exampleXmlGenerationMode = signal<ExampleXmlGenerationMode>(
    loadExampleXmlGenerationMode(),
  );
  protected readonly expandAll = signal(true);

  protected readonly rootFileOptions = computed<ExampleXmlFileOption[]>(() =>
    this.cachedFileNames()
      .filter((fileName) =>
        Array.from(this.schemaModel().elements.values()).some((entry) => entry.fileName === fileName),
      )
      .map((fileName) => ({
        value: fileName,
        label: fileName,
      })),
  );

  protected readonly rootOptions = computed(() => {
    const selectedRootFile = this.selectedRootFile();
    const rootNames = Array.from(this.schemaModel().elements.entries())
      .filter(([, entry]) => !selectedRootFile || entry.fileName === selectedRootFile)
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b));

    if (rootNames.length === 0) {
      return [];
    }

    return [
      { value: ALL_NODES_VALUE, label: 'File' },
      ...rootNames.map((name) => ({ value: name, label: name })),
    ];
  });

  protected readonly fileGroups = computed<SchemaFileGroup[]>(() => {
    const schemaInfoByFile = extractSchemaFileInfo(this.cachedFiles());
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
      schemaInfo: schemaInfoByFile[fileName] ?? null,
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

    this.cachedFiles.set(mergedEntries);
    this.fileNames.set(mergedEntries.map((file) => file.name));
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

  protected onRootFileSelectionChange(fileName: string): void {
    this.selectedRootFile.set(fileName);
    saveSelectedRootFile(fileName);
    const nextRoot = this.resolveRootForFile(this.schemaModel(), fileName);
    this.selectedRoot.set(nextRoot);
    this.generateExampleXmlForRoot(nextRoot);
  }

  protected onExampleXmlGenerationModeChange(mode: ExampleXmlGenerationMode): void {
    this.exampleXmlGenerationMode.set(mode);
    saveExampleXmlGenerationMode(mode);
    this.generateExampleXmlForRoot(this.selectedRoot());
  }

  protected async onRemoveFile(fileName: string): Promise<void> {
    const nextCachedFiles = this.cachedFiles().filter((file) => file.name !== fileName);
    this.cachedFiles.set(nextCachedFiles);
    this.fileNames.set(nextCachedFiles.map((file) => file.name));
    saveCachedFiles(nextCachedFiles);
    await this.applySelection();
  }

  private async restoreCachedFiles(): Promise<void> {
    const cachedFiles = loadCachedFiles();
    this.cachedFiles.set(cachedFiles);
    this.fileNames.set(cachedFiles.map((file) => file.name));

    if (cachedFiles.length === 0) {
      return;
    }

    await this.applySelection();
  }

  private async applySelection(): Promise<void> {
    const selectedEntries = this.cachedFiles();

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

      const initialRootFile = this.resolveInitialRootFile(schemaModel);
      this.selectedRootFile.set(initialRootFile);
      const initialRoot = this.resolveRootForFile(schemaModel, initialRootFile);
      this.selectedRoot.set(initialRoot);
      this.generateExampleXmlForRoot(initialRoot);
    } catch (error) {
      console.error('Error parsing files:', error);
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Could not parse XSD files',
      );
      this.processedNodes.set([]);
      this.schemaModel.set(buildSchemaModel([]));
      this.selectedRootFile.set('');
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

  private resolveInitialRootFile(schemaModel: SchemaModel): string {
    const fileNames = this.cachedFileNames().filter((fileName) =>
      Array.from(schemaModel.elements.values()).some((entry) => entry.fileName === fileName),
    );

    if (fileNames.length === 0) {
      return '';
    }

    const savedRootFile = loadSelectedRootFile();
    if (savedRootFile && fileNames.includes(savedRootFile)) {
      saveSelectedRootFile(savedRootFile);
      return savedRootFile;
    }

    const nextRootFile = fileNames[0];
    saveSelectedRootFile(nextRootFile);
    return nextRootFile;
  }

  private resolveRootForFile(schemaModel: SchemaModel, fileName: string): string {
    const rootNames = Array.from(schemaModel.elements.entries())
      .filter(([, entry]) => entry.fileName === fileName)
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b));

    if (rootNames.length === 0) {
      saveSelectedRoot('');
      return '';
    }

    const savedRoot = loadSelectedRoot();
    if (savedRoot && (savedRoot === ALL_NODES_VALUE || rootNames.includes(savedRoot))) {
      saveSelectedRoot(savedRoot);
      return savedRoot;
    }

    const nextRoot = ALL_NODES_VALUE;
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
        generateExampleXml(
          rootName,
          this.schemaModel(),
          this.selectedRootFile(),
          this.exampleXmlGenerationMode(),
        ),
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
