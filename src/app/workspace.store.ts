import { computed, Injectable, signal } from '@angular/core';
import {
  buildSchemaModel,
  extractSchemaFileInfo,
  parseCachedFiles,
  processXsdDocs,
  readFiles,
} from '../schema';
import { loadCachedFiles, saveCachedFiles } from '../storage';
import type {
  CachedFileEntry,
  ExampleXmlFileOption,
  ProcessedNode,
  SchemaFileInfo,
  SchemaModel,
} from '../types';

export interface SchemaFileGroup {
  fileName: string;
  nodes: ProcessedNode[];
  schemaInfo: SchemaFileInfo | null;
  rawText: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly cachedFiles = signal<CachedFileEntry[]>([]);
  readonly fileNames = signal<string[]>([]);
  readonly processedNodes = signal<ProcessedNode[]>([]);
  readonly schemaModel = signal<SchemaModel>(buildSchemaModel([]));

  readonly cachedFileNames = computed(() =>
    this.fileNames()
      .slice()
      .sort((left, right) => left.localeCompare(right)),
  );

  readonly rootFileOptions = computed<ExampleXmlFileOption[]>(() =>
    this.cachedFileNames()
      .filter((fileName) =>
        Array.from(this.schemaModel().elements.values()).some((entry) => entry.fileName === fileName),
      )
      .map((fileName) => ({
        value: fileName,
        label: fileName,
      })),
  );

  readonly fileGroups = computed<SchemaFileGroup[]>(() => {
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
      rawText: this.cachedFiles().find((file) => file.name === fileName)?.text ?? '',
    }));
  });

  constructor() {
    void this.restoreCachedFiles();
  }

  async onFileChange(event: Event): Promise<void> {
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

  async onRemoveFile(fileName: string): Promise<void> {
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
    } catch (error) {
      console.error('Error parsing files:', error);
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Could not parse XSD files',
      );
      this.processedNodes.set([]);
      this.schemaModel.set(buildSchemaModel([]));
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
}
