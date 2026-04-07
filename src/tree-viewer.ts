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
import type { CachedFileEntry, ProcessedNode, SchemaModel } from "./types";

export class TreeViewer {
  private readonly container: HTMLElement;
  private schemaModel: SchemaModel = buildSchemaModel([]);
  private exampleXml = "";

  constructor(container: HTMLElement) {
    this.container = container;
    this.addSearchBar();
    this.addControlButtons();
    this.addExampleXmlPanel();
    this.addXmlCheatsheetPanel();
    this.addXsdCheatsheetPanel();
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

  private addXmlCheatsheetPanel(): void {
    const panel = document.createElement("section");
    panel.className = "cheatsheet-panel";
    panel.innerHTML = `
      <div class="cheatsheet-header">
        <div class="cheatsheet-title">XML Handbook</div>
        <div class="cheatsheet-subtitle">
          Practical reference for reading, editing, and validating XML documents.
        </div>
      </div>
      <div class="cheatsheet-sections">
        <section class="cheatsheet-section">
          <div class="cheatsheet-section-title">Document Structure</div>
          <div class="cheatsheet-grid">
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">XML Declaration</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;?xml version="1.0" encoding="UTF-8"?&gt;</code></pre>
              <div class="cheatsheet-note">Optional but common first line. It declares XML version and encoding.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Root Element</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;invoice&gt;
  &lt;number&gt;INV-1&lt;/number&gt;
&lt;/invoice&gt;</code></pre>
              <div class="cheatsheet-note">Every XML document must have exactly one root element containing everything else.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Simple Element</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;customer&gt;Alice&lt;/customer&gt;</code></pre>
              <div class="cheatsheet-note">A standard element with text content between the opening and closing tags.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Attributes</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;customer id="123" active="true"&gt;Alice&lt;/customer&gt;</code></pre>
              <div class="cheatsheet-note">Attributes belong in the opening tag. They are often used for identifiers, flags, and metadata.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Nested Elements</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;order&gt;
  &lt;id&gt;42&lt;/id&gt;
  &lt;customer&gt;
    &lt;name&gt;Alice&lt;/name&gt;
  &lt;/customer&gt;
&lt;/order&gt;</code></pre>
              <div class="cheatsheet-note">Elements can contain child elements, which form the document tree.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Repeated Siblings</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;items&gt;
  &lt;item&gt;Coffee&lt;/item&gt;
  &lt;item&gt;Tea&lt;/item&gt;
  &lt;item&gt;Water&lt;/item&gt;
&lt;/items&gt;</code></pre>
              <div class="cheatsheet-note">Schemas often allow repeated sibling elements with <code>maxOccurs</code>.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Empty Element</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;attachment /&gt;</code></pre>
              <div class="cheatsheet-note">Use self-closing syntax when the element has no text or children.</div>
            </div>
          </div>
        </section>
        <section class="cheatsheet-section">
          <div class="cheatsheet-section-title">Namespaces And Metadata</div>
          <div class="cheatsheet-grid">
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Default Namespace</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;invoice xmlns="urn:example:invoice"&gt;
  &lt;number&gt;INV-1&lt;/number&gt;
&lt;/invoice&gt;</code></pre>
              <div class="cheatsheet-note"><code>xmlns</code> declares the default namespace for the current element and its descendants.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Prefixed Namespace</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;doc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="urn:example invoice.xsd"&gt;
  &lt;title&gt;Example&lt;/title&gt;
&lt;/doc&gt;</code></pre>
              <div class="cheatsheet-note">Prefixes are commonly used for <code>xsi</code> attributes and mixed vocabularies.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Comment</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;!-- Internal note: generated from test schema --&gt;</code></pre>
              <div class="cheatsheet-note">Comments are allowed almost anywhere, but the text cannot contain <code>--</code>.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Processing Instruction</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;?xml-stylesheet type="text/xsl" href="view.xsl"?&gt;</code></pre>
              <div class="cheatsheet-note">Processing instructions pass directives to tools, not to the schema itself.</div>
            </div>
          </div>
        </section>
        <section class="cheatsheet-section">
          <div class="cheatsheet-section-title">Text And Content Rules</div>
          <div class="cheatsheet-grid">
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Escaping Text</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;text&gt;Tom &amp;amp; Jerry &amp;lt;3&lt;/text&gt;</code></pre>
              <div class="cheatsheet-note">Escape special characters like <code>&amp;</code>, <code>&lt;</code>, <code>&gt;</code> inside text.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">CDATA Section</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;script&gt;&lt;![CDATA[
if (a &lt; b) {
  console.log("raw content");
}
]]&gt;&lt;/script&gt;</code></pre>
              <div class="cheatsheet-note">CDATA keeps content unescaped, except that the sequence <code>]]&gt;</code> cannot appear inside it.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Mixed Content</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;paragraph&gt;
  Use &lt;emphasis&gt;strong&lt;/emphasis&gt; formatting.
&lt;/paragraph&gt;</code></pre>
              <div class="cheatsheet-note">Text and child elements can coexist when the schema allows mixed content.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Common Scalar Values</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;flag&gt;true&lt;/flag&gt;
&lt;count&gt;3&lt;/count&gt;
&lt;date&gt;2026-04-07&lt;/date&gt;
&lt;timestamp&gt;2026-04-07T12:00:00Z&lt;/timestamp&gt;</code></pre>
              <div class="cheatsheet-note">Typical XSD scalar formats include booleans, numbers, ISO dates, and datetimes.</div>
            </div>
          </div>
        </section>
        <section class="cheatsheet-section">
          <div class="cheatsheet-section-title">Validation And XSD Habits</div>
          <div class="cheatsheet-grid">
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Order Matters</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;person&gt;
  &lt;firstName&gt;Alice&lt;/firstName&gt;
  &lt;lastName&gt;Nguyen&lt;/lastName&gt;
&lt;/person&gt;</code></pre>
              <div class="cheatsheet-note">In many XSD sequences, element order must match the schema exactly.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Optional vs Required</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;user role="admin"&gt;
  &lt;name&gt;Alice&lt;/name&gt;
  &lt;email&gt;alice@example.com&lt;/email&gt;
&lt;/user&gt;</code></pre>
              <div class="cheatsheet-note">Required attributes and elements must be present. Optional ones depend on schema constraints.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Validation Mindset</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;invoice status="draft"&gt;
  &lt;number&gt;INV-1&lt;/number&gt;
&lt;/invoice&gt;</code></pre>
              <div class="cheatsheet-note">To satisfy an XSD, watch element names, order, cardinality, namespaces, and attribute requirements together.</div>
            </div>
          </div>
        </section>
      </div>
    `;

    this.container.parentNode?.insertBefore(panel, this.container);
    panel
      .querySelectorAll<HTMLElement>('code[class*="language-"]')
      .forEach((element) => Prism.highlightElement(element));
    this.sortCheatsheetCardsByHeight(panel);
  }

  private addXsdCheatsheetPanel(): void {
    const panel = document.createElement("section");
    panel.className = "cheatsheet-panel";
    panel.innerHTML = `
      <div class="cheatsheet-header">
        <div class="cheatsheet-title">XSD Handbook</div>
        <div class="cheatsheet-subtitle">
          Practical reference for defining schemas, constraints, and reusable types.
        </div>
      </div>
      <div class="cheatsheet-sections">
        <section class="cheatsheet-section">
          <div class="cheatsheet-section-title">Schema Structure</div>
          <div class="cheatsheet-grid">
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Schema Root</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"&gt;
  ...
&lt;/xs:schema&gt;</code></pre>
              <div class="cheatsheet-note">Every XSD starts with <code>xs:schema</code> and usually declares the XML Schema namespace.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Target Namespace</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:schema
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  targetNamespace="urn:example:invoice"
  elementFormDefault="qualified"&gt;
  ...
&lt;/xs:schema&gt;</code></pre>
              <div class="cheatsheet-note">Use <code>targetNamespace</code> to define the schema’s vocabulary and <code>elementFormDefault</code> to control qualification.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Top-Level Element</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:element name="invoice" type="InvoiceType" /&gt;</code></pre>
              <div class="cheatsheet-note">Global elements are common document entry points and can be referenced elsewhere.</div>
            </div>
          </div>
        </section>
        <section class="cheatsheet-section">
          <div class="cheatsheet-section-title">Types And Constraints</div>
          <div class="cheatsheet-grid">
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Complex Type</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:complexType name="InvoiceType"&gt;
  &lt;xs:sequence&gt;
    &lt;xs:element name="number" type="xs:string" /&gt;
    &lt;xs:element name="total" type="xs:decimal" /&gt;
  &lt;/xs:sequence&gt;
&lt;/xs:complexType&gt;</code></pre>
              <div class="cheatsheet-note">Use complex types for elements that contain child elements or attributes.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Simple Type Restriction</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:simpleType name="StatusType"&gt;
  &lt;xs:restriction base="xs:string"&gt;
    &lt;xs:enumeration value="draft" /&gt;
    &lt;xs:enumeration value="final" /&gt;
  &lt;/xs:restriction&gt;
&lt;/xs:simpleType&gt;</code></pre>
              <div class="cheatsheet-note">Restrictions narrow base types by enumeration, pattern, numeric bounds, length, and more.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Attribute Declaration</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:attribute name="currency" type="xs:string" use="required" /&gt;</code></pre>
              <div class="cheatsheet-note">Attributes can be optional or required. Use them for metadata rather than nested structure.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Pattern Constraint</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:simpleType name="CodeType"&gt;
  &lt;xs:restriction base="xs:string"&gt;
    &lt;xs:pattern value="[A-Z]{3}-[0-9]{2}" /&gt;
  &lt;/xs:restriction&gt;
&lt;/xs:simpleType&gt;</code></pre>
              <div class="cheatsheet-note">Patterns apply regular-expression-like matching to textual values.</div>
            </div>
          </div>
        </section>
        <section class="cheatsheet-section">
          <div class="cheatsheet-section-title">Composition And Reuse</div>
          <div class="cheatsheet-grid">
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Sequence</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:sequence&gt;
  &lt;xs:element name="firstName" type="xs:string" /&gt;
  &lt;xs:element name="lastName" type="xs:string" /&gt;
&lt;/xs:sequence&gt;</code></pre>
              <div class="cheatsheet-note">A sequence enforces element order exactly as declared.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Choice</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:choice&gt;
  &lt;xs:element name="email" type="xs:string" /&gt;
  &lt;xs:element name="phone" type="xs:string" /&gt;
&lt;/xs:choice&gt;</code></pre>
              <div class="cheatsheet-note">A choice means only one of the alternatives is expected unless occurrence rules say otherwise.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Occurrences</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:element
  name="item"
  type="ItemType"
  minOccurs="0"
  maxOccurs="unbounded" /&gt;</code></pre>
              <div class="cheatsheet-note">Use <code>minOccurs</code> and <code>maxOccurs</code> to express optional, required, and repeating content.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Extension</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:complexContent&gt;
  &lt;xs:extension base="BasePartyType"&gt;
    &lt;xs:sequence&gt;
      &lt;xs:element name="taxId" type="xs:string" /&gt;
    &lt;/xs:sequence&gt;
  &lt;/xs:extension&gt;
&lt;/xs:complexContent&gt;</code></pre>
              <div class="cheatsheet-note">Extensions let one type inherit another and add more content.</div>
            </div>
          </div>
        </section>
        <section class="cheatsheet-section">
          <div class="cheatsheet-section-title">Validation And Design Habits</div>
          <div class="cheatsheet-grid">
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Reference Vs Inline</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:element ref="common:address" /&gt;

&lt;xs:element name="address"&gt;
  &lt;xs:complexType&gt;...&lt;/xs:complexType&gt;
&lt;/xs:element&gt;</code></pre>
              <div class="cheatsheet-note">Use global reusable definitions when many elements share the same shape.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Required Thinking</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:element name="id" type="xs:string" /&gt;
&lt;xs:attribute name="status" type="StatusType" use="required" /&gt;</code></pre>
              <div class="cheatsheet-note">Ask which parts are mandatory, repeatable, ordered, namespaced, and constrained before writing example XML.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Documentation</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:annotation&gt;
  &lt;xs:documentation&gt;
    Human-readable guidance for schema users.
  &lt;/xs:documentation&gt;
&lt;/xs:annotation&gt;</code></pre>
              <div class="cheatsheet-note">Annotations make large schemas much easier to understand and maintain.</div>
            </div>
            <div class="cheatsheet-card">
              <div class="cheatsheet-card-title">Validation Mindset</div>
              <pre class="cheatsheet-code"><code class="language-markup">&lt;xs:element name="invoice" type="InvoiceType" /&gt;
&lt;xs:complexType name="InvoiceType"&gt;...&lt;/xs:complexType&gt;</code></pre>
              <div class="cheatsheet-note">To validate successfully, align names, order, cardinality, namespaces, base types, and restrictions together.</div>
            </div>
          </div>
        </section>
      </div>
    `;

    this.container.parentNode?.insertBefore(panel, this.container);
    panel
      .querySelectorAll<HTMLElement>('code[class*="language-"]')
      .forEach((element) => Prism.highlightElement(element));
    this.sortCheatsheetCardsByHeight(panel);
  }

  private sortCheatsheetCardsByHeight(panel: HTMLElement): void {
    const sortCards = () => {
      panel.querySelectorAll<HTMLElement>(".cheatsheet-grid").forEach((grid) => {
        const cards = Array.from(grid.querySelectorAll<HTMLElement>(".cheatsheet-card"));
        cards
          .sort((left, right) => left.offsetHeight - right.offsetHeight)
          .forEach((card) => grid.appendChild(card));
      });
    };

    window.requestAnimationFrame(() => {
      sortCards();
      window.requestAnimationFrame(sortCards);
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
