export interface CachedFileEntry {
  name: string;
  text: string;
}

export interface LoadedXsdDoc {
  name: string;
  doc: XMLDocument;
}

export interface SchemaEntry {
  element: Element;
  fileName: string;
  targetNamespace: string;
}

export interface SchemaModel {
  docs: LoadedXsdDoc[];
  elements: Map<string, SchemaEntry>;
  complexTypes: Map<string, SchemaEntry>;
  simpleTypes: Map<string, SchemaEntry>;
  namespaces: Map<string, string>;
  relatedFilesByFile: Map<string, string[]>;
  builtInTypes: Set<string>;
}

export interface SchemaFileInfo {
  targetNamespace: string;
  elementFormDefault: string;
  attributeFormDefault: string;
  version: string;
  schemaId: string;
  imports: Array<{
    kind: string;
    namespace: string;
    schemaLocation: string;
  }>;
  namespaceDeclarations: Array<{
    prefix: string;
    uri: string;
  }>;
}

export interface ProcessedAttribute {
  name: string;
  type: string | null;
  use: string | null;
  documentation: string;
}

export interface Restrictions {
  base?: string | null;
  minLength?: string | null;
  maxLength?: string | null;
  pattern?: string | null;
  minInclusive?: string | null;
  maxInclusive?: string | null;
}

export interface ProcessedNode {
  name: string;
  type: string;
  typeNamespaceUri?: string | null;
  documentation: string;
  documentationEntries: string[];
  appinfoEntries: string[];
  restrictions: Restrictions | null;
  attributes: ProcessedAttribute[] | null;
  children: ProcessedNode[];
  fileName: string | null;
  minOccurs?: string | null;
  maxOccurs?: string | null;
  baseType?: string | null;
}

export interface ExampleXmlNode {
  name: string;
  attributes: Record<string, string>;
  children: ExampleXmlNode[];
  text: string;
}

export type ExampleXmlGenerationMode = "minimal" | "maximal";

export interface ExampleXmlFileOption {
  value: string;
  label: string;
}

export interface BuildNodeContext {
  depth: number;
  ancestors: Set<string>;
  generationMode: ExampleXmlGenerationMode;
}
