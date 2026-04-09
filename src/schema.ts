import { BUILT_IN_TYPES } from "./constants";
import {
  getChildElements,
  getDescendantsByLocalName,
  getFirstDescendant,
  stripNamespace,
} from "./dom-utils";
import type {
  CachedFileEntry,
  LoadedXsdDoc,
  ProcessedAttribute,
  ProcessedNode,
  SchemaFileInfo,
  Restrictions,
  SchemaModel,
} from "./types";

export async function readFiles(files: FileList | File[]): Promise<CachedFileEntry[]> {
  const entries: CachedFileEntry[] = [];

  for (const file of Array.from(files)) {
    try {
      entries.push({
        name: file.name,
        text: await file.text(),
      });
    } catch (error) {
      console.error(`Error reading file ${file.name}:`, error);
    }
  }

  return entries;
}

export function parseCachedFiles(fileEntries: CachedFileEntry[]): LoadedXsdDoc[] {
  const parser = new DOMParser();
  const xsdDocs: LoadedXsdDoc[] = [];

  for (const file of fileEntries) {
    try {
      const doc = parser.parseFromString(file.text, "text/xml");
      if (doc.querySelector("parsererror")) {
        throw new Error(`Invalid XML in file: ${file.name}`);
      }

      xsdDocs.push({ name: file.name, doc });
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }

  if (xsdDocs.length === 0) {
    throw new Error("No valid XSD files were loaded");
  }

  return xsdDocs;
}

export function createEmptySchemaModel(): SchemaModel {
  return {
    docs: [],
    elements: new Map(),
    complexTypes: new Map(),
    simpleTypes: new Map(),
    namespaces: new Map(),
    relatedFilesByFile: new Map(),
    builtInTypes: new Set(BUILT_IN_TYPES),
  };
}

export function buildSchemaModel(docs: LoadedXsdDoc[]): SchemaModel {
  const model = createEmptySchemaModel();
  model.docs = docs;
  const docNames = docs.map(({ name }) => name);

  for (const { doc, name } of docs) {
    const schemaElement = doc.documentElement;
    if (!schemaElement) {
      continue;
    }

    const targetNamespace = schemaElement.getAttribute("targetNamespace") || "";
    model.namespaces.set(name, targetNamespace);
    model.relatedFilesByFile.set(name, collectRelatedSchemaFiles(schemaElement, name, docNames));

    getChildElements(schemaElement, "element").forEach((element) => {
      const elementName = element.getAttribute("name");
      if (elementName) {
        model.elements.set(elementName, {
          element,
          fileName: name,
          targetNamespace,
        });
      }
    });

    getDescendantsByLocalName(schemaElement, "complexType").forEach((typeElement) => {
      const typeName = typeElement.getAttribute("name");
      if (typeName) {
        model.complexTypes.set(typeName, {
          element: typeElement,
          fileName: name,
          targetNamespace,
        });
      }
    });

    getDescendantsByLocalName(schemaElement, "simpleType").forEach((typeElement) => {
      const typeName = typeElement.getAttribute("name");
      if (typeName) {
        model.simpleTypes.set(typeName, {
          element: typeElement,
          fileName: name,
          targetNamespace,
        });
      }
    });
  }

  return model;
}

function collectRelatedSchemaFiles(
  schemaElement: Element,
  currentFileName: string,
  availableFileNames: string[],
): string[] {
  const relatedFiles = new Set<string>([currentFileName]);

  ["import", "include", "redefine"].forEach((tagName) => {
    getChildElements(schemaElement, tagName).forEach((entry) => {
      const resolvedFileName = resolveSchemaLocation(entry.getAttribute("schemaLocation"), availableFileNames);
      if (resolvedFileName) {
        relatedFiles.add(resolvedFileName);
      }
    });
  });

  return Array.from(relatedFiles);
}

function resolveSchemaLocation(
  schemaLocation: string | null,
  availableFileNames: string[],
): string | null {
  if (!schemaLocation) {
    return null;
  }

  const normalizedLocation = normalizeSchemaPath(schemaLocation);
  const directMatch = availableFileNames.find((fileName) => normalizeSchemaPath(fileName) === normalizedLocation);
  if (directMatch) {
    return directMatch;
  }

  const locationFileName = extractFileName(schemaLocation);
  return availableFileNames.find((fileName) => extractFileName(fileName) === locationFileName) ?? null;
}

function normalizeSchemaPath(value: string): string {
  return value.replace(/\\/g, "/").trim().toLowerCase();
}

function extractFileName(value: string): string {
  const normalized = normalizeSchemaPath(value);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

export function processXsdDocs(docs: LoadedXsdDoc[]): ProcessedNode[] {
  const types: ProcessedNode[] = [];

  for (const { doc, name } of docs) {
    types.push(...processSimpleTypes(doc, name));
    types.push(...processComplexTypes(doc, name));
    types.push(...processElements(doc, name));
  }

  return types;
}

export function extractSchemaFileInfo(
  fileEntries: CachedFileEntry[],
): Record<string, SchemaFileInfo> {
  const parser = new DOMParser();
  const infoByFile: Record<string, SchemaFileInfo> = {};

  fileEntries.forEach((file) => {
    try {
      const doc = parser.parseFromString(file.text, "text/xml");
      if (doc.querySelector("parsererror")) {
        return;
      }

      const schemaElement = doc.documentElement;
      if (
        !schemaElement ||
        schemaElement.localName !== "schema" ||
        schemaElement.namespaceURI !== "http://www.w3.org/2001/XMLSchema"
      ) {
        return;
      }

      infoByFile[file.name] = {
        targetNamespace: schemaElement.getAttribute("targetNamespace") || "",
        elementFormDefault: schemaElement.getAttribute("elementFormDefault") || "",
        attributeFormDefault: schemaElement.getAttribute("attributeFormDefault") || "",
        version: schemaElement.getAttribute("version") || "",
        schemaId: schemaElement.getAttribute("id") || "",
        imports: ["import", "include", "redefine"].flatMap((tagName) =>
          getChildElements(schemaElement, tagName).map((entry) => ({
            kind: tagName,
            namespace: entry.getAttribute("namespace") || "",
            schemaLocation: entry.getAttribute("schemaLocation") || "",
          })),
        ),
        namespaceDeclarations: Array.from(schemaElement.attributes)
          .filter((attribute) => attribute.name === "xmlns" || attribute.name.startsWith("xmlns:"))
          .map((attribute) => ({
            prefix: attribute.name === "xmlns" ? "(default)" : attribute.name.slice("xmlns:".length),
            uri: attribute.value,
          })),
      };
    } catch (error) {
      console.error(`Error extracting schema root data from ${file.name}:`, error);
    }
  });

  return infoByFile;
}

function processSimpleTypes(doc: XMLDocument, fileName: string): ProcessedNode[] {
  return getDescendantsByLocalName(doc.documentElement, "simpleType")
    .map((typeElement) => processType(typeElement, "simpleType", fileName))
    .filter((node): node is ProcessedNode => node !== null);
}

function processComplexTypes(doc: XMLDocument, fileName: string): ProcessedNode[] {
  return getDescendantsByLocalName(doc.documentElement, "complexType")
    .map((typeElement) => processType(typeElement, "complexType", fileName))
    .filter((node): node is ProcessedNode => node !== null);
}

function processElements(doc: XMLDocument, fileName: string): ProcessedNode[] {
  return getChildElements(doc.documentElement, "element")
    .map((typeElement) => processType(typeElement, "element", fileName))
    .filter((node): node is ProcessedNode => node !== null);
}

function processType(
  typeElement: Element,
  typeKind: string,
  fileName: string | null
): ProcessedNode | null {
  const name = typeElement.getAttribute("name");
  if (!name) {
    return null;
  }

  const children: ProcessedNode[] = [];
  const documentationEntries = getDocumentationEntries(typeElement);
  const documentation = documentationEntries[0] || "";
  const appinfoEntries = getAppinfoEntries(typeElement);
  const restrictions = getRestrictions(typeElement);
  const attributes = getAttributes(typeElement);

  getDescendantsByLocalName(typeElement, "enumeration").forEach((enumElement) => {
    const value = enumElement.getAttribute("value");
    if (!value) {
      return;
    }

    children.push({
      name: value,
      type: "enumeration",
      typeNamespaceUri: null,
      documentation: getDocumentation(enumElement),
      documentationEntries: getDocumentationEntries(enumElement),
      appinfoEntries: getAppinfoEntries(enumElement),
      restrictions: null,
      attributes: null,
      children: [],
      fileName: null,
    });
  });

  getNestedElementSummaries(typeElement).forEach((child) => children.push(child));

  const extension = getFirstDescendant(typeElement, "extension");
  if (extension) {
    const extensionNode = processComplexContentExtension(extension, fileName);
    if (extensionNode) {
      children.push(extensionNode);
    }
  }

  return {
    name,
    type: typeKind,
    typeNamespaceUri: resolveTypeNamespaceUri(typeElement),
    documentation,
    documentationEntries,
    appinfoEntries,
    restrictions,
    attributes,
    children,
    fileName,
  };
}

function getNestedElementSummaries(root: Element): ProcessedNode[] {
  const directContainers = ["sequence", "choice", "all", "complexType", "group"];
  const summaries: ProcessedNode[] = [];

  directContainers.forEach((tagName) => {
    getChildElements(root, tagName).forEach((container) => {
      getChildElements(container, "element").forEach((element) => {
        const elementName = element.getAttribute("name") || element.getAttribute("ref");
        if (!elementName) {
          return;
        }

        summaries.push({
          name: stripNamespace(elementName),
          type: element.getAttribute("type") || "element",
          typeNamespaceUri: resolveTypeNamespaceUri(element),
          documentation: getDocumentation(element),
          documentationEntries: getDocumentationEntries(element),
          appinfoEntries: getAppinfoEntries(element),
          restrictions: null,
          attributes: null,
          children: [],
          fileName: null,
          minOccurs: element.getAttribute("minOccurs"),
          maxOccurs: element.getAttribute("maxOccurs"),
        });
      });
    });
  });

  return summaries;
}

export function getDocumentation(element: Element): string {
  return getDocumentationEntries(element)[0] || "";
}

function getDocumentationEntries(element: Element): string[] {
  const annotation = getChildElements(element, "annotation")[0];
  if (!annotation) {
    return [];
  }

  return getChildElements(annotation, "documentation")
    .map((documentation) => documentation.textContent?.trim() || "")
    .filter(Boolean);
}

function getAppinfoEntries(element: Element): string[] {
  const annotation = getChildElements(element, "annotation")[0];
  if (!annotation) {
    return [];
  }

  const entries: string[] = [];

  getChildElements(annotation, "appinfo").forEach((appinfo) => {
    const childElements = Array.from(appinfo.children);

    if (childElements.length > 0) {
      childElements.forEach((childElement) => {
        entries.push(...extractAppinfoTagValues(childElement));
      });
      return;
    }

    const text = appinfo.textContent?.trim();
    if (!text) {
      return;
    }

    const source = appinfo.getAttribute("source");
    entries.push(source ? `${source}: ${text}` : text);
  });

  return entries;
}

function extractAppinfoTagValues(
  element: Element,
  path = element.localName,
): string[] {
  const childElements = Array.from(element.children);
  const entries: string[] = [];

  if (childElements.length === 0) {
    const text = element.textContent?.trim();
    if (text) {
      entries.push(`${path}: ${text}`);
      return entries;
    }

    const attributeText = Array.from(element.attributes)
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .join(", ");

    if (attributeText) {
      entries.push(`${path}: ${attributeText}`);
    }

    return entries;
  }

  childElements.forEach((childElement) => {
    entries.push(...extractAppinfoTagValues(childElement, `${path}/${childElement.localName}`));
  });

  return entries;
}

function getRestrictions(element: Element): Restrictions | null {
  const restrictions: Restrictions = {};
  const restriction = getFirstDescendant(element, "restriction");

  if (!restriction) {
    return null;
  }

  const base = restriction.getAttribute("base");
  if (base) {
    restrictions.base = base;
  }

  ["minLength", "maxLength", "pattern", "minInclusive", "maxInclusive"].forEach(
    (attr) => {
      const restrictionNode = getChildElements(restriction, attr)[0];
      if (restrictionNode) {
        restrictions[attr as keyof Restrictions] =
          restrictionNode.getAttribute("value");
      }
    }
  );

  return Object.keys(restrictions).length > 0 ? restrictions : null;
}

function getAttributes(element: Element): ProcessedAttribute[] | null {
  const attributes = getDescendantsByLocalName(element, "attribute")
    .map((attr) => ({
      name: attr.getAttribute("name") || stripNamespace(attr.getAttribute("ref")),
      type: attr.getAttribute("type"),
      use: attr.getAttribute("use"),
      documentation: getDocumentation(attr),
    }))
    .filter((attr): attr is ProcessedAttribute => Boolean(attr.name));

  return attributes.length > 0 ? attributes : null;
}

function collectChildElementDefinitions(ownerElement: Element): Element[] {
  const groups = ["sequence", "choice", "all"];
  const childElements: Element[] = [];

  groups.forEach((groupName) => {
    getChildElements(ownerElement, groupName).forEach((group) => {
      const directElements = getChildElements(group, "element");
      if (groupName === "choice" && directElements.length > 0) {
        childElements.push(directElements[0]);
      } else {
        childElements.push(...directElements);
      }
    });
  });

  return childElements;
}

function processComplexContentExtension(
  extensionElement: Element,
  fileName: string | null
): ProcessedNode | null {
  const name = stripNamespace(extensionElement.getAttribute("base"));
  if (!name) {
    return null;
  }

  return {
    name,
    type: "complexContent",
    typeNamespaceUri: null,
    documentation: "",
    documentationEntries: getDocumentationEntries(extensionElement),
    appinfoEntries: getAppinfoEntries(extensionElement),
    restrictions: null,
    attributes: null,
    children: collectChildElementDefinitions(extensionElement).map((element) => ({
      name:
        element.getAttribute("name") || stripNamespace(element.getAttribute("ref")),
      type: element.getAttribute("type") || "element",
      typeNamespaceUri: resolveTypeNamespaceUri(element),
      documentation: getDocumentation(element),
      documentationEntries: getDocumentationEntries(element),
      appinfoEntries: getAppinfoEntries(element),
      restrictions: null,
      attributes: null,
      children: [],
      fileName: null,
      minOccurs: element.getAttribute("minOccurs"),
      maxOccurs: element.getAttribute("maxOccurs"),
    })),
    fileName,
    baseType: name,
  };
}

function resolveTypeNamespaceUri(element: Element): string | null {
  const typeName = element.getAttribute("type");
  if (!typeName || !typeName.includes(":")) {
    return null;
  }

  const [prefix] = typeName.split(":", 1);
  return element.lookupNamespaceURI(prefix) || null;
}
