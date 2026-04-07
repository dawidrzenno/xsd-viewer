import {
  CACHED_FILES_STORAGE_KEY,
  HANDBOOK_STATE_STORAGE_KEY_PREFIX,
  SELECTED_ROOT_STORAGE_KEY,
} from "./constants";
import type { CachedFileEntry } from "./types";

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
