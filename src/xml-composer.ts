import { ALL_NODES_VALUE } from './constants';
import { escapeXml, getChildElements, stripNamespace } from './dom-utils';
import type { SchemaModel } from './types';

export interface XmlComposerAttributeDefinition {
  name: string;
  required: boolean;
  defaultValue: string;
}

export interface XmlComposerChildDefinition {
  name: string;
  minOccurs: number;
  maxOccurs: number | null;
  element: Element;
}

export interface XmlComposerNodeDefinition {
  name: string;
  attributes: XmlComposerAttributeDefinition[];
  children: XmlComposerChildDefinition[];
  allowsText: boolean;
  textExample: string;
}

export interface XmlComposerAttributeDraft {
  name: string;
  required: boolean;
  value: string;
}

export interface XmlComposerNodeDraft {
  id: string;
  name: string;
  attributes: XmlComposerAttributeDraft[];
  children: XmlComposerNodeDraft[];
  text: string;
  definition: XmlComposerNodeDefinition;
  isVirtualRoot?: boolean;
}

export interface XmlComposerDraft {
  root: XmlComposerNodeDraft;
  targetNamespace: string;
}

export function getComposerRootNames(schemaModel: SchemaModel, fileName: string): string[] {
  return Array.from(schemaModel.elements.entries())
    .filter(([, entry]) => !fileName || entry.fileName === fileName)
    .map(([name]) => name)
    .sort((left, right) => left.localeCompare(right));
}

export function createXmlComposerDraft(
  rootElementName: string,
  schemaModel: SchemaModel,
  fileName: string,
  createId: () => string,
): XmlComposerDraft {
  if (rootElementName === ALL_NODES_VALUE) {
    return createVirtualFileDraft(schemaModel, fileName, createId);
  }

  const rootEntry = schemaModel.elements.get(rootElementName);
  if (!rootEntry) {
    throw new Error(`Root element "${rootElementName}" was not found`);
  }

  return {
    root: createDraftNode(rootEntry.element, schemaModel, createId, new Set()),
    targetNamespace: rootEntry.targetNamespace,
  };
}

export function createChildDraftNode(
  childDefinition: XmlComposerChildDefinition,
  schemaModel: SchemaModel,
  createId: () => string,
  ancestors: Set<string>,
): XmlComposerNodeDraft {
  return createDraftNode(childDefinition.element, schemaModel, createId, ancestors);
}

export function serializeXmlComposerDraft(
  root: XmlComposerNodeDraft,
  targetNamespace: string,
): string {
  if (root.isVirtualRoot) {
    const children = root.children.map((child) =>
      stringifyDraftNode(ensureNamespaceAttribute(child, targetNamespace), 0),
    );

    return ['<?xml version="1.0" encoding="UTF-8"?>', ...children].join('\n');
  }

  const serializedRoot = stringifyDraftNode(
    ensureNamespaceAttribute(root, targetNamespace),
    0,
  );

  return ['<?xml version="1.0" encoding="UTF-8"?>', serializedRoot].join('\n');
}

function createVirtualFileDraft(
  schemaModel: SchemaModel,
  fileName: string,
  createId: () => string,
): XmlComposerDraft {
  if (!fileName) {
    throw new Error('A source file must be selected to compose XML for the file');
  }

  const rootElements = Array.from(schemaModel.elements.values())
    .filter((entry) => entry.fileName === fileName)
    .sort((left, right) => {
      const leftName = left.element.getAttribute('name') || '';
      const rightName = right.element.getAttribute('name') || '';
      return leftName.localeCompare(rightName);
    });

  if (rootElements.length === 0) {
    throw new Error(`No top-level elements were found for "${fileName}"`);
  }

  const targetNamespace = rootElements[0]?.targetNamespace ?? '';
  const root: XmlComposerNodeDraft = {
    id: createId(),
    name: '__file__',
    attributes: [],
    children: rootElements.map((entry) => createDraftNode(entry.element, schemaModel, createId, new Set())),
    text: '',
    definition: {
      name: '__file__',
      attributes: [],
      children: rootElements.map((entry) => ({
        name: entry.element.getAttribute('name') || '',
        minOccurs: 0,
        maxOccurs: null,
        element: entry.element,
      })),
      allowsText: false,
      textExample: '',
    },
    isVirtualRoot: true,
  };

  return { root, targetNamespace };
}

function ensureNamespaceAttribute(
  node: XmlComposerNodeDraft,
  targetNamespace: string,
): XmlComposerNodeDraft {
  if (!targetNamespace || node.attributes.some((attribute) => attribute.name === 'xmlns')) {
    return node;
  }

  return {
    ...node,
    attributes: [{ name: 'xmlns', required: true, value: targetNamespace }, ...node.attributes],
  };
}

function createDraftNode(
  elementDefinition: Element,
  schemaModel: SchemaModel,
  createId: () => string,
  ancestors: Set<string>,
): XmlComposerNodeDraft {
  const resolvedElement = resolveElementReference(elementDefinition, schemaModel);
  const nodeName = resolvedElement.getAttribute('name') || stripNamespace(resolvedElement.getAttribute('ref'));
  if (!nodeName) {
    throw new Error('Encountered an element without a usable name');
  }

  const nextAncestors = new Set([...ancestors, nodeName]);
  const definition = buildNodeDefinition(resolvedElement, schemaModel, nextAncestors);
  const node: XmlComposerNodeDraft = {
    id: createId(),
    name: definition.name,
    attributes: definition.attributes.map((attribute) => ({
      name: attribute.name,
      required: attribute.required,
      value: attribute.defaultValue,
    })),
    children: [],
    text: definition.allowsText ? definition.textExample : '',
    definition,
  };

  definition.children.forEach((childDefinition) => {
    for (let index = 0; index < childDefinition.minOccurs; index += 1) {
      node.children.push(createDraftNode(childDefinition.element, schemaModel, createId, nextAncestors));
    }
  });

  return node;
}

function buildNodeDefinition(
  elementDefinition: Element,
  schemaModel: SchemaModel,
  ancestors: Set<string>,
): XmlComposerNodeDefinition {
  const resolvedElement = resolveElementReference(elementDefinition, schemaModel);
  const nodeName =
    resolvedElement.getAttribute('name') || stripNamespace(resolvedElement.getAttribute('ref')) || 'element';

  const inlineComplexType = getChildElements(resolvedElement, 'complexType')[0];
  const inlineSimpleType = getChildElements(resolvedElement, 'simpleType')[0];
  const typeName = stripNamespace(resolvedElement.getAttribute('type'));

  if (inlineComplexType) {
    return {
      name: nodeName,
      ...buildComplexTypeDefinition(inlineComplexType, schemaModel, ancestors),
    };
  }

  if (inlineSimpleType) {
    return {
      name: nodeName,
      attributes: [],
      children: [],
      allowsText: true,
      textExample: exampleValueForSimpleType(inlineSimpleType),
    };
  }

  if (typeName) {
    if (isBuiltInXsdType(typeName, schemaModel)) {
      return {
        name: nodeName,
        attributes: [],
        children: [],
        allowsText: true,
        textExample: exampleValueForBuiltInType(typeName),
      };
    }

    const complexType = schemaModel.complexTypes.get(typeName);
    if (complexType) {
      return {
        name: nodeName,
        ...buildComplexTypeDefinition(complexType.element, schemaModel, new Set([...ancestors, typeName])),
      };
    }

    const simpleType = schemaModel.simpleTypes.get(typeName);
    if (simpleType) {
      return {
        name: nodeName,
        attributes: [],
        children: [],
        allowsText: true,
        textExample: exampleValueForSimpleType(simpleType.element),
      };
    }
  }

  return {
    name: nodeName,
    attributes: [],
    children: collectChildDefinitions(resolvedElement, schemaModel, ancestors),
    allowsText: false,
    textExample: '',
  };
}

function buildComplexTypeDefinition(
  complexTypeElement: Element,
  schemaModel: SchemaModel,
  ancestors: Set<string>,
): Omit<XmlComposerNodeDefinition, 'name'> {
  const complexContent = getChildElements(complexTypeElement, 'complexContent')[0];
  if (complexContent) {
    const extension = getChildElements(complexContent, 'extension')[0];
    const restriction = getChildElements(complexContent, 'restriction')[0];
    if (extension || restriction) {
      return buildComplexTypeExtensionDefinition(extension ?? restriction, schemaModel, ancestors);
    }
  }

  const simpleContent = getChildElements(complexTypeElement, 'simpleContent')[0];
  if (simpleContent) {
    const extension = getChildElements(simpleContent, 'extension')[0];
    const restriction = getChildElements(simpleContent, 'restriction')[0];
    const contentNode = extension ?? restriction;
    if (contentNode) {
      const baseType = stripNamespace(contentNode.getAttribute('base')) || 'string';
      return {
        attributes: collectAttributes(contentNode, schemaModel),
        children: [],
        allowsText: true,
        textExample: resolveTypeExampleValue(baseType, schemaModel),
      };
    }
  }

  const inlineSimpleType = getChildElements(complexTypeElement, 'simpleType')[0];
  return {
    attributes: collectAttributes(complexTypeElement, schemaModel),
    children: collectChildDefinitions(complexTypeElement, schemaModel, ancestors),
    allowsText: Boolean(inlineSimpleType),
    textExample: inlineSimpleType ? exampleValueForSimpleType(inlineSimpleType) : '',
  };
}

function buildComplexTypeExtensionDefinition(
  extensionElement: Element,
  schemaModel: SchemaModel,
  ancestors: Set<string>,
): Omit<XmlComposerNodeDefinition, 'name'> {
  const attributes = new Map<string, XmlComposerAttributeDefinition>();
  const children = new Map<string, XmlComposerChildDefinition>();
  let allowsText = false;
  let textExample = '';

  const baseType = stripNamespace(extensionElement.getAttribute('base'));
  if (baseType && !ancestors.has(baseType)) {
    const baseComplexType = schemaModel.complexTypes.get(baseType);
    const baseSimpleType = schemaModel.simpleTypes.get(baseType);

    if (baseComplexType) {
      const baseDefinition = buildComplexTypeDefinition(
        baseComplexType.element,
        schemaModel,
        new Set([...ancestors, baseType]),
      );
      baseDefinition.attributes.forEach((attribute) => attributes.set(attribute.name, attribute));
      baseDefinition.children.forEach((child) => children.set(child.name, child));
      allowsText = baseDefinition.allowsText;
      textExample = baseDefinition.textExample;
    } else if (baseSimpleType) {
      allowsText = true;
      textExample = exampleValueForSimpleType(baseSimpleType.element);
    } else if (isBuiltInXsdType(baseType, schemaModel)) {
      allowsText = true;
      textExample = exampleValueForBuiltInType(baseType);
    }
  }

  collectAttributes(extensionElement, schemaModel).forEach((attribute) => {
    attributes.set(attribute.name, attribute);
  });
  collectChildDefinitions(extensionElement, schemaModel, ancestors).forEach((child) => {
    children.set(child.name, child);
  });

  return {
    attributes: Array.from(attributes.values()),
    children: Array.from(children.values()),
    allowsText,
    textExample,
  };
}

function collectChildDefinitions(
  ownerElement: Element,
  schemaModel: SchemaModel,
  ancestors: Set<string>,
): XmlComposerChildDefinition[] {
  const childDefinitions: XmlComposerChildDefinition[] = [];

  ownerElement.childNodes.forEach((childNode) => {
    if (!(childNode instanceof Element)) {
      return;
    }

    switch (childNode.localName) {
      case 'element':
        pushChildDefinition(childDefinitions, childNode, schemaModel, ancestors);
        break;
      case 'sequence':
      case 'all':
      case 'choice':
        childDefinitions.push(...collectChildDefinitions(childNode, schemaModel, ancestors));
        break;
      default:
        break;
    }
  });

  return dedupeChildDefinitions(childDefinitions);
}

function pushChildDefinition(
  accumulator: XmlComposerChildDefinition[],
  elementDefinition: Element,
  schemaModel: SchemaModel,
  ancestors: Set<string>,
): void {
  const resolvedElement = resolveElementReference(elementDefinition, schemaModel);
  const name =
    resolvedElement.getAttribute('name') || stripNamespace(resolvedElement.getAttribute('ref'));

  if (!name || ancestors.has(name)) {
    return;
  }

  accumulator.push({
    name,
    minOccurs: parseOccursValue(elementDefinition.getAttribute('minOccurs'), 1),
    maxOccurs: parseMaxOccursValue(elementDefinition.getAttribute('maxOccurs')),
    element: resolvedElement,
  });
}

function dedupeChildDefinitions(
  childDefinitions: XmlComposerChildDefinition[],
): XmlComposerChildDefinition[] {
  const definitionsByName = new Map<string, XmlComposerChildDefinition>();
  childDefinitions.forEach((definition) => {
    const existing = definitionsByName.get(definition.name);
    if (!existing) {
      definitionsByName.set(definition.name, definition);
      return;
    }

    definitionsByName.set(definition.name, {
      ...definition,
      minOccurs: Math.max(existing.minOccurs, definition.minOccurs),
      maxOccurs:
        existing.maxOccurs === null || definition.maxOccurs === null
          ? null
          : Math.max(existing.maxOccurs, definition.maxOccurs),
    });
  });

  return Array.from(definitionsByName.values());
}

function collectAttributes(
  ownerElement: Element,
  schemaModel: SchemaModel,
): XmlComposerAttributeDefinition[] {
  const attributes = new Map<string, XmlComposerAttributeDefinition>();

  ownerElement.childNodes.forEach((childNode) => {
    if (!(childNode instanceof Element) || childNode.localName !== 'attribute') {
      return;
    }

    const resolvedAttribute = resolveAttributeReference(childNode, schemaModel);
    const name =
      resolvedAttribute.getAttribute('name') || stripNamespace(resolvedAttribute.getAttribute('ref'));
    if (!name) {
      return;
    }

    const inlineSimpleType = getChildElements(resolvedAttribute, 'simpleType')[0];
    const typeName = stripNamespace(resolvedAttribute.getAttribute('type')) || 'string';

    attributes.set(name, {
      name,
      required: resolvedAttribute.getAttribute('use') === 'required',
      defaultValue: inlineSimpleType
        ? exampleValueForSimpleType(inlineSimpleType)
        : resolveTypeExampleValue(typeName, schemaModel),
    });
  });

  return Array.from(attributes.values());
}

function resolveElementReference(elementDefinition: Element, schemaModel: SchemaModel): Element {
  const refName = stripNamespace(elementDefinition.getAttribute('ref'));
  if (refName && !elementDefinition.getAttribute('name')) {
    return schemaModel.elements.get(refName)?.element ?? elementDefinition;
  }

  return elementDefinition;
}

function resolveAttributeReference(attributeDefinition: Element, schemaModel: SchemaModel): Element {
  const refName = stripNamespace(attributeDefinition.getAttribute('ref'));
  if (!refName || attributeDefinition.getAttribute('name')) {
    return attributeDefinition;
  }

  const globalAttribute = schemaModel.docs
    .flatMap(({ doc }) => Array.from(doc.documentElement.children))
    .find((child) => child.localName === 'attribute' && child.getAttribute('name') === refName);

  return globalAttribute ?? attributeDefinition;
}

function parseOccursValue(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseMaxOccursValue(value: string | null): number | null {
  if (!value) {
    return 1;
  }

  if (value === 'unbounded') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

function exampleValueForSimpleType(simpleTypeElement: Element): string {
  const restriction = getChildElements(simpleTypeElement, 'restriction')[0];
  if (!restriction) {
    return 'value';
  }

  const enumerations = getChildElements(restriction, 'enumeration')
    .map((enumNode) => enumNode.getAttribute('value'))
    .filter((value): value is string => Boolean(value));

  if (enumerations.length > 0) {
    return enumerations[0];
  }

  const baseType = stripNamespace(restriction.getAttribute('base')) || 'string';
  return exampleValueForBuiltInType(baseType);
}

function resolveTypeExampleValue(typeName: string, schemaModel: SchemaModel): string {
  if (isBuiltInXsdType(typeName, schemaModel)) {
    return exampleValueForBuiltInType(typeName);
  }

  const simpleType = schemaModel.simpleTypes.get(typeName);
  if (simpleType) {
    return exampleValueForSimpleType(simpleType.element);
  }

  return 'value';
}

function exampleValueForBuiltInType(typeName: string): string {
  switch (stripNamespace(typeName).toLowerCase()) {
    case 'boolean':
      return 'true';
    case 'date':
      return '2026-01-01';
    case 'datetime':
      return '2026-01-01T00:00:00Z';
    case 'decimal':
    case 'double':
    case 'float':
    case 'int':
    case 'integer':
    case 'long':
    case 'short':
    case 'unsignedint':
    case 'unsignedlong':
    case 'unsignedshort':
      return '1';
    default:
      return 'example';
  }
}

function isBuiltInXsdType(typeName: string, schemaModel: SchemaModel): boolean {
  const normalized = stripNamespace(typeName).toLowerCase();
  const raw = typeName.toLowerCase();

  if (raw.startsWith('xs:') || raw.startsWith('xsd:')) {
    return true;
  }

  return schemaModel.builtInTypes.has(normalized);
}

function stringifyDraftNode(node: XmlComposerNodeDraft, depth: number): string {
  const indent = '  '.repeat(depth);
  const attributes = node.attributes
    .filter((attribute) => attribute.value !== '' || attribute.required)
    .map((attribute) => ` ${attribute.name}="${escapeXml(attribute.value)}"`)
    .join('');

  const trimmedText = node.text.trim();

  if (node.children.length === 0 && !trimmedText) {
    return `${indent}<${node.name}${attributes} />`;
  }

  if (node.children.length === 0) {
    return `${indent}<${node.name}${attributes}>${escapeXml(trimmedText)}</${node.name}>`;
  }

  const children = node.children.map((child) => stringifyDraftNode(child, depth + 1)).join('\n');
  const textLine = trimmedText ? `${escapeXml(trimmedText)}\n` : '';

  return `${indent}<${node.name}${attributes}>${textLine}${children}\n${indent}</${node.name}>`;
}
