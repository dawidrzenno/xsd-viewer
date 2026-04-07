import {
  CACHED_FILES_STORAGE_KEY,
  EXAMPLE_XML_COMMENT_OPTIONS_STORAGE_KEY,
  HANDBOOK_STATE_STORAGE_KEY_PREFIX,
  SCHEMA_FILE_STATE_STORAGE_KEY,
  SELECTED_ROOT_FILE_STORAGE_KEY,
  SELECTED_ROOT_STORAGE_KEY,
} from "./constants";
import type { CachedFileEntry, ExampleXmlCommentOptions } from "./types";

export function loadCachedFiles(): CachedFileEntry[] {
  try {
    const raw = window.localStorage.getItem(CACHED_FILES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load cached XSD files:", error);
    return [];
  }
}

export function saveCachedFiles(fileEntries: CachedFileEntry[]): void {
  try {
    window.localStorage.setItem(
      CACHED_FILES_STORAGE_KEY,
      JSON.stringify(fileEntries)
    );
  } catch (error) {
    console.error("Could not save cached XSD files:", error);
  }
}

export function loadSelectedRoot(): string {
  try {
    return window.localStorage.getItem(SELECTED_ROOT_STORAGE_KEY) || "";
  } catch (error) {
    console.error("Could not load selected root:", error);
    return "";
  }
}

export function loadSelectedRootFile(): string {
  try {
    return window.localStorage.getItem(SELECTED_ROOT_FILE_STORAGE_KEY) || "";
  } catch (error) {
    console.error("Could not load selected root file:", error);
    return "";
  }
}

export function saveSelectedRootFile(fileName: string): void {
  try {
    window.localStorage.setItem(SELECTED_ROOT_FILE_STORAGE_KEY, fileName);
  } catch (error) {
    console.error("Could not save selected root file:", error);
  }
}

export function saveSelectedRoot(rootName: string): void {
  try {
    window.localStorage.setItem(SELECTED_ROOT_STORAGE_KEY, rootName);
  } catch (error) {
    console.error("Could not save selected root:", error);
  }
}

export function loadHandbookCollapsedState(handbookId: string): boolean {
  try {
    return window.localStorage.getItem(`${HANDBOOK_STATE_STORAGE_KEY_PREFIX}${handbookId}`) === "true";
  } catch (error) {
    console.error("Could not load handbook state:", error);
    return false;
  }
}

export function saveHandbookCollapsedState(handbookId: string, isCollapsed: boolean): void {
  try {
    window.localStorage.setItem(
      `${HANDBOOK_STATE_STORAGE_KEY_PREFIX}${handbookId}`,
      String(isCollapsed)
    );
  } catch (error) {
    console.error("Could not save handbook state:", error);
  }
}

export function loadExampleXmlCommentOptions(
  defaults: ExampleXmlCommentOptions
): ExampleXmlCommentOptions {
  try {
    const raw = window.localStorage.getItem(EXAMPLE_XML_COMMENT_OPTIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }

    return {
      ...defaults,
      ...parsed,
    };
  } catch (error) {
    console.error("Could not load example XML comment options:", error);
    return defaults;
  }
}

export function saveExampleXmlCommentOptions(options: ExampleXmlCommentOptions): void {
  try {
    window.localStorage.setItem(
      EXAMPLE_XML_COMMENT_OPTIONS_STORAGE_KEY,
      JSON.stringify(options)
    );
  } catch (error) {
    console.error("Could not save example XML comment options:", error);
  }
}

export function loadSchemaFileCollapsedState(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(SCHEMA_FILE_STATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Could not load schema file state:", error);
    return {};
  }
}

export function saveSchemaFileCollapsedState(state: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(
      SCHEMA_FILE_STATE_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error("Could not save schema file state:", error);
  }
}
