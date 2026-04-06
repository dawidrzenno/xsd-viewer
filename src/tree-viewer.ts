import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/themes/prism-tomorrow.css";
import { VIRTUAL_ROOT_VALUE } from "./constants";
import { buildSchemaModel, parseCachedFiles, processXsdDocs, readFiles } from "./schema";
import {
  loadCachedFiles,
  loadSelectedRoot,
  saveCachedFiles,
  saveSelectedRoot,
} from "./storage";
import { generateExampleXml } from "./xml-generator";
import type { CachedFileEntry, LoadedXsdDoc, ProcessedNode, SchemaModel } from "./types";

export class TreeViewer {
  private readonly container: HTMLElement;
  private loadedDocs: LoadedXsdDoc[] = [];
  private schemaModel: SchemaModel = buildSchemaModel([]);
  private exampleXml = "";

  constructor(container: HTMLElement) {
    this.container = container;
    this.addSearchBar();
    this.addControlButtons();
    this.addExampleXmlPanel();
    this.addFileSelectionStatus();
  }

  async restoreCachedFiles(): Promise<void> {
    const cachedFiles = loadCachedFiles();
    if (cachedFiles.length === 0) {
      this.renderFileSelectionStatus([]);
      return;
    }

    this.renderFileSelectionStatus(cachedFiles.map((file) => file.name));
    await this.parseCachedEntries(cachedFiles, false);
  }

  async parseFiles(files: FileList | File[]): Promise<void> {
    const fileEntries = await readFiles(files);
    await this.parseCachedEntries(fileEntries, true);
  }

  private async parseCachedEntries(
    fileEntries: CachedFileEntry[],
    persistToCache: boolean
  ): Promise<void> {
    try {
      this.showLoading();
      const xsdDocs = parseCachedFiles(fileEntries);

      if (persistToCache) {
        saveCachedFiles(fileEntries);
      }

      this.loadedDocs = xsdDocs;
      this.schemaModel = buildSchemaModel(xsdDocs);
      this.renderFileSelectionStatus(fileEntries.map((file) => file.name));

      const processedData = processXsdDocs(xsdDocs);
      this.renderTree(processedData);
      this.renderExampleXml("");
      this.populateRootSelector();
    } catch (error) {
      console.error("Error parsing files:", error);
      this.showError(
        error instanceof Error ? error.message : "Could not parse XSD files"
      );
    } finally {
      this.hideLoading();
      this.toggleAll(true);
      this.handleGenerateExampleXml();
    }
  }

  private createNodeElement(node: ProcessedNode): HTMLDivElement {
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "tree-node";

    const contentDiv = document.createElement("div");
    contentDiv.className = "node-content";

    const childrenDiv = document.createElement("div");
    childrenDiv.className = "children hidden";

    if (node.children.length > 0) {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "toggle-btn";
      toggleBtn.type = "button";
      toggleBtn.onclick = (event) => {
        event.stopPropagation();
        toggleBtn.classList.toggle("open");
        childrenDiv.classList.toggle("hidden");
      };
      contentDiv.appendChild(toggleBtn);
    }

    const nodeInfo = document.createElement("div");
    nodeInfo.className = "node-info";

    const nameTypeDiv = document.createElement("div");
    const nameSpan = document.createElement("span");
    nameSpan.className = "node-name";
    nameSpan.textContent = node.name;
    nameTypeDiv.appendChild(nameSpan);

    const typeSpan = document.createElement("span");
    typeSpan.className = "node-type";
    typeSpan.textContent = node.type;
    nameTypeDiv.appendChild(typeSpan);
    nodeInfo.appendChild(nameTypeDiv);

    if (node.fileName || node.minOccurs || node.maxOccurs) {
      const metadataDiv = document.createElement("div");
      metadataDiv.className = "metadata";
      const metadata: string[] = [];

      if (node.fileName) metadata.push(`File: ${node.fileName}`);
      if (node.minOccurs) metadata.push(`Min: ${node.minOccurs}`);
      if (node.maxOccurs) metadata.push(`Max: ${node.maxOccurs}`);

      metadataDiv.textContent = metadata.join(" | ");
      nodeInfo.appendChild(metadataDiv);
    }

    if (node.attributes?.length) {
      const attributesDiv = document.createElement("div");
      attributesDiv.className = "metadata";
      attributesDiv.textContent = `Attributes: ${node.attributes
        .map((attr) => `${attr.name}${attr.use === "required" ? "*" : ""}`)
        .join(", ")}`;
      nodeInfo.appendChild(attributesDiv);
    }

    contentDiv.appendChild(nodeInfo);
    nodeDiv.appendChild(contentDiv);

    if (node.documentation) {
      const docDiv = document.createElement("div");
      docDiv.className = "documentation";
      docDiv.textContent = node.documentation;
      nodeDiv.appendChild(docDiv);
    }

    if (node.restrictions) {
      const restrictionsDiv = document.createElement("div");
      restrictionsDiv.className = "restrictions";
      restrictionsDiv.textContent = Object.entries(node.restrictions)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" | ");
      nodeDiv.appendChild(restrictionsDiv);
    }

    if (node.children.length > 0) {
      node.children.forEach((child) => {
        childrenDiv.appendChild(this.createNodeElement(child));
      });
      nodeDiv.appendChild(childrenDiv);
    }

    return nodeDiv;
  }

  private renderTree(types: ProcessedNode[]): void {
    this.container.innerHTML = "";

    const typesByFile = types.reduce<Record<string, ProcessedNode[]>>((acc, type) => {
      const fileName = type.fileName || "Unknown File";
      acc[fileName] ||= [];
      acc[fileName].push(type);
      return acc;
    }, {});

    Object.entries(typesByFile).forEach(([fileName, fileTypes]) => {
      const fileSection = document.createElement("div");
      fileSection.className = "file-section";

      const fileHeader = document.createElement("div");
      fileHeader.className = "file-header";
      fileHeader.textContent = `File: ${fileName} (${fileTypes.length} types)`;
      fileSection.appendChild(fileHeader);

      fileTypes.forEach((type) => fileSection.appendChild(this.createNodeElement(type)));
      this.container.appendChild(fileSection);
    });
  }

  private showLoading(): void {
    document.querySelector(".loader")?.remove();

    const loader = document.createElement("div");
    loader.className = "loader";
    loader.innerHTML = `
      <div class="loader-content">
        <div class="spinner"></div>
        <div>Processing files...</div>
      </div>
    `;
    document.body.appendChild(loader);
  }

  private hideLoading(): void {
    document.querySelector(".loader")?.remove();
  }

  private showError(message: string): void {
    document.querySelector(".error-message")?.remove();

    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    this.container.prepend(errorDiv);

    window.setTimeout(() => errorDiv.remove(), 5000);
  }

  private addFileSelectionStatus(): void {
    const fileInputSection = document.querySelector(".file-input-section");
    if (!fileInputSection || document.getElementById("fileSelectionStatus")) {
      return;
    }

    const status = document.createElement("div");
    status.id = "fileSelectionStatus";
    status.className = "file-selection-status";
    status.textContent = "No cached schema";
    fileInputSection.appendChild(status);
  }

  private renderFileSelectionStatus(fileNames: string[]): void {
    const status = document.getElementById("fileSelectionStatus");
    if (!status) {
      return;
    }

    if (fileNames.length === 0) {
      status.textContent = "No cached schema";
      return;
    }

    status.textContent =
      fileNames.length === 1
        ? `Cached: ${fileNames[0]}`
        : `Cached: ${fileNames.join(", ")}`;
  }

  private addSearchBar(): void {
    const searchDiv = document.createElement("div");
    searchDiv.className = "search-container";
    searchDiv.innerHTML = `
      <input
        type="text"
        id="schemaSearch"
        placeholder="Search schema..."
        class="search-input"
      >
    `;

    document.querySelector("header .header-content")?.appendChild(searchDiv);

    document.getElementById("schemaSearch")?.addEventListener("input", (event) => {
      const searchTerm = (event.target as HTMLInputElement).value.toLowerCase();
      this.filterNodes(searchTerm);
    });
  }

  private filterNodes(searchTerm: string): void {
    document.querySelectorAll<HTMLElement>(".tree-node").forEach((node) => {
      const nodeName = node.querySelector(".node-name")?.textContent?.toLowerCase() || "";
      const nodeType = node.querySelector(".node-type")?.textContent?.toLowerCase() || "";
      const documentation =
        node.querySelector(".documentation")?.textContent?.toLowerCase() || "";

      const matches =
        nodeName.includes(searchTerm) ||
        nodeType.includes(searchTerm) ||
        documentation.includes(searchTerm);

      node.style.display = matches ? "" : "none";
    });
  }

  private addControlButtons(): void {
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "control-buttons";
    buttonContainer.innerHTML = `
      <button class="control-btn" id="expandAll" type="button">Expand All</button>
      <button class="control-btn" id="collapseAll" type="button">Collapse All</button>
    `;

    document.querySelector(".search-container")?.appendChild(buttonContainer);
    document.getElementById("expandAll")?.addEventListener("click", () => this.toggleAll(true));
    document
      .getElementById("collapseAll")
      ?.addEventListener("click", () => this.toggleAll(false));
  }

  private addExampleXmlPanel(): void {
    const panel = document.createElement("section");
    panel.className = "example-panel";
    panel.innerHTML = `
      <div class="example-panel-header">
        <div>
          <div class="example-panel-title">Example XML Generator</div>
          <div class="example-panel-subtitle">
            Generate a minimal sample instance document from the loaded schema.
          </div>
        </div>
        <div class="example-panel-controls">
          <select id="rootElementSelect" class="example-select">
            <option value="">Choose root element</option>
          </select>
          <button id="copyXml" class="control-btn" type="button">
            Copy XML
          </button>
        </div>
      </div>
      <pre class="example-output">
         <code id="exampleXmlOutput" class="language-markup">
            Load one or more XSD files to generate example XML.
         </code>
      </pre>
    `;

    this.container.parentNode?.insertBefore(panel, this.container);

    document.getElementById("copyXml")?.addEventListener("click", async () => {
      if (!this.exampleXml) {
        return;
      }

      try {
        await navigator.clipboard.writeText(this.exampleXml);
      } catch (error) {
        console.error("Could not copy XML:", error);
      }
    });
  }

  private populateRootSelector(): void {
    const select = document.getElementById("rootElementSelect") as HTMLSelectElement | null;
    if (!select) {
      return;
    }

    const rootNames = Array.from(this.schemaModel.elements.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    select.innerHTML = `
      <option value="${VIRTUAL_ROOT_VALUE}">Virtual root (all top-level elements)</option>
      ${rootNames.map((name) => `<option value="${name}">${name}</option>`).join("")}
    `;

    const savedRoot = loadSelectedRoot();
    const availableValues = [VIRTUAL_ROOT_VALUE, ...rootNames];
    if (savedRoot && availableValues.includes(savedRoot)) {
      select.value = savedRoot;
      return;
    }

    if (rootNames.length === 1) {
      select.value = rootNames[0];
      saveSelectedRoot(rootNames[0]);
      return;
    }

    select.value = VIRTUAL_ROOT_VALUE;
    saveSelectedRoot(VIRTUAL_ROOT_VALUE);
  }

  handleGenerateExampleXml(): void {
    const select = document.getElementById("rootElementSelect") as HTMLSelectElement | null;
    const rootName = select?.value || "";

    if (!rootName) {
      this.renderExampleXml("");
      return;
    }

    try {
      saveSelectedRoot(rootName);
      const xml = generateExampleXml(rootName, this.schemaModel);
      this.exampleXml = xml;
      this.renderExampleXml(xml);
    } catch (error) {
      console.error("Could not generate example XML:", error);
      this.renderExampleXml(
        `Could not generate example XML: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private renderExampleXml(content: string): void {
    const output = document.getElementById("exampleXmlOutput");
    if (!output) {
      return;
    }

    if (content) {
      output.innerHTML = Prism.highlight(content, Prism.languages.markup, "markup");
      return;
    }

    output.textContent = "Load one or more XSD files to generate example XML.";
  }

  private toggleAll(expand: boolean): void {
    document.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.classList.toggle("open", expand);
    });

    document.querySelectorAll(".children").forEach((div) => {
      div.classList.toggle("hidden", !expand);
    });
  }
}
