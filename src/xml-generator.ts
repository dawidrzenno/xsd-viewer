import { VIRTUAL_ROOT_VALUE } from "./constants";
import { escapeXml, getChildElements, getFirstDescendant, stripNamespace } from "./dom-utils";
import { getDocumentation } from "./schema";
import type {
  BuildNodeContext,
  ExampleXmlCommentOptions,
  ExampleXmlNode,
  SchemaModel,
} from "./types";

export function generateExampleXml(
  rootElementName: string,
  schemaModel: SchemaModel,
  commentOptions: ExampleXmlCommentOptions
): string {
  const virtualRootFileName = parseVirtualRootFileName(rootElementName);
  if (virtualRootFileName) {
    return generateVirtualRootXml(schemaModel, commentOptions, virtualRootFileName);
  }

  const rootDefinition = schemaModel.elements.get(rootElementName);
  if (!rootDefinition) {
    throw new Error(`Root element "${rootElementName}" was not found`);
  }

  const rootNode = buildExampleNode(rootDefinition.element, schemaModel, {
    depth: 0,
    ancestors: new Set(),
  }, commentOptions);

  if (rootDefinition.targetNamespace) {
    rootNode.attributes["xmlns"] = rootDefinition.targetNamespace;
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    stringifyXmlNode(rootNode),
  ].join("\n");
}

function generateVirtualRootXml(
  schemaModel: SchemaModel,
  commentOptions: ExampleXmlCommentOptions,
  fileName: string
): string {
  const topLevelElements = Array.from(schemaModel.elements.entries())
    .filter(([, definition]) => definition.fileName === fileName)
    .sort(([a], [b]) => a.localeCompare(b));

  if (topLevelElements.length === 0) {
    throw new Error(`No top-level elements were found for file "${fileName}"`);
  }

  const virtualRoot: ExampleXmlNode = {
    name: "Root",
    attributes: {},
    children: [],
    text: "",
    comments: commentOptions.elementNames
      ? [`Virtual root generated to include all top-level XSD elements from ${fileName}.`]
      : [],
  };

  topLevelElements.forEach(([, definition]) => {
    const childNode = buildExampleNode(definition.element, schemaModel, {
      depth: 1,
      ancestors: new Set(["Root"]),
    }, commentOptions);

    if (definition.targetNamespace) {
      childNode.attributes["xmlns"] = definition.targetNamespace;
    }

    virtualRoot.children.push(childNode);
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    stringifyXmlNode(virtualRoot),
  ].join("\n");
}

function buildExampleNode(
  elementDefinition: Element,
  schemaModel: SchemaModel,
  context: BuildNodeContext,
  commentOptions: ExampleXmlCommentOptions
): ExampleXmlNode {
  const localName = elementDefinition.getAttribute("name");
  const refName = stripNamespace(elementDefinition.getAttribute("ref"));
  const explicitName = localName || refName;

  if (!explicitName) {
    throw new Error("Encountered an element without a usable name");
  }

  if (refName && !localName) {
    const referenced = schemaModel.elements.get(refName);
    if (referenced) {
      const referencedNode = buildExampleNode(
        referenced.element,
        schemaModel,
        context,
        commentOptions
      );
      referencedNode.comments = dedupeComments([
        ...buildElementComments(elementDefinition, schemaModel, explicitName, commentOptions),
        ...referencedNode.comments,
      ]);
      return referencedNode;
    }
  }

  const node: ExampleXmlNode = {
    name: explicitName,
    attributes: {},
    children: [],
    text: "",
    comments: buildElementComments(elementDefinition, schemaModel, explicitName, commentOptions),
  };

  applyAttributes(node, elementDefinition, schemaModel);

  const inlineComplexType = getChildElements(elementDefinition, "complexType")[0];
  const inlineSimpleType = getChildElements(elementDefinition, "simpleType")[0];
  const typeName = stripNamespace(elementDefinition.getAttribute("type"));

  if (inlineComplexType) {
    node.comments = dedupeComments([
      ...node.comments,
      ...buildTypeComments(inlineComplexType, schemaModel, "inline complexType", commentOptions),
    ]);
    applyComplexType(node, inlineComplexType, schemaModel, {
      ...context,
      ancestors: new Set([...context.ancestors, explicitName]),
    }, commentOptions);
    return node;
  }

  if (inlineSimpleType) {
    node.comments = dedupeComments([
      ...node.comments,
      ...buildTypeComments(inlineSimpleType, schemaModel, "inline simpleType", commentOptions),
    ]);
    node.text = exampleValueForSimpleType(inlineSimpleType);
    return node;
  }

  if (typeName) {
    if (commentOptions.declaredTypes) {
      node.comments = dedupeComments([...node.comments, `Type: ${typeName}`]);
    }
    if (isBuiltInXsdType(typeName, schemaModel)) {
      node.comments = dedupeComments([
        ...node.comments,
        ...buildBuiltInTypeComments(typeName, commentOptions),
      ]);
      node.text = exampleValueForBuiltInType(typeName);
      return node;
    }

    const complexType = schemaModel.complexTypes.get(typeName);
    if (complexType) {
      node.comments = dedupeComments([
        ...node.comments,
        ...buildTypeComments(
          complexType.element,
          schemaModel,
          `complexType ${typeName}`,
          commentOptions
        ),
      ]);
      applyComplexType(node, complexType.element, schemaModel, {
        ...context,
        ancestors: new Set([...context.ancestors, explicitName, typeName]),
      }, commentOptions);
      return node;
    }

    const simpleType = schemaModel.simpleTypes.get(typeName);
    if (simpleType) {
      node.comments = dedupeComments([
        ...node.comments,
        ...buildTypeComments(
          simpleType.element,
          schemaModel,
          `simpleType ${typeName}`,
          commentOptions
        ),
      ]);
      node.text = exampleValueForSimpleType(simpleType.element);
      return node;
    }
  }

  const childElements = collectChildElementDefinitions(elementDefinition);
  if (childElements.length > 0) {
    childElements.forEach((childElement) => {
      const childName =
        childElement.getAttribute("name") ||
        stripNamespace(childElement.getAttribute("ref"));

      if (!childName || context.ancestors.has(childName)) {
        return;
      }

      node.children.push(
        buildExampleNode(childElement, schemaModel, {
          ...context,
          depth: context.depth + 1,
          ancestors: new Set([...context.ancestors, explicitName]),
        }, commentOptions)
      );
    });
    return node;
  }

  node.text = exampleValueForBuiltInType("string");
  return node;
}

function applyComplexType(
  node: ExampleXmlNode,
  complexTypeElement: Element,
  schemaModel: SchemaModel,
  context: BuildNodeContext,
  commentOptions: ExampleXmlCommentOptions
): void {
  applyAttributes(node, complexTypeElement, schemaModel);

  const complexContent = getChildElements(complexTypeElement, "complexContent")[0];
  if (complexContent) {
    const extension = getChildElements(complexContent, "extension")[0];
    const restriction = getChildElements(complexContent, "restriction")[0];
    if (extension) {
      applyComplexTypeExtension(node, extension, schemaModel, context, commentOptions);
      return;
    }
    if (restriction) {
      applyComplexTypeExtension(node, restriction, schemaModel, context, commentOptions);
      return;
    }
  }

  const simpleContent = getChildElements(complexTypeElement, "simpleContent")[0];
  if (simpleContent) {
    const extension = getChildElements(simpleContent, "extension")[0];
    const restriction = getChildElements(simpleContent, "restriction")[0];
    const contentNode = extension || restriction;

    if (contentNode) {
      const baseType = stripNamespace(contentNode.getAttribute("base"));
      if (baseType) {
        node.text = resolveTypeExampleValue(baseType, schemaModel);
      }
      applyAttributes(node, contentNode, schemaModel);
      return;
    }
  }

  collectChildElementDefinitions(complexTypeElement).forEach((childElement) => {
    const childName =
      childElement.getAttribute("name") ||
      stripNamespace(childElement.getAttribute("ref"));

    if (!childName || context.ancestors.has(childName)) {
      return;
    }

    node.children.push(
        buildExampleNode(childElement, schemaModel, {
          ...context,
          depth: context.depth + 1,
          ancestors: new Set([...context.ancestors, node.name]),
        }, commentOptions)
      );
  });

  if (node.children.length === 0 && !node.text) {
    const inlineSimpleType = getChildElements(complexTypeElement, "simpleType")[0];
    if (inlineSimpleType) {
      node.text = exampleValueForSimpleType(inlineSimpleType);
    }
  }
}

function applyComplexTypeExtension(
  node: ExampleXmlNode,
  extensionElement: Element,
  schemaModel: SchemaModel,
  context: BuildNodeContext,
  commentOptions: ExampleXmlCommentOptions
): void {
  const baseType = stripNamespace(extensionElement.getAttribute("base"));
  if (baseType && !context.ancestors.has(baseType)) {
    const baseComplexType = schemaModel.complexTypes.get(baseType);
    const baseSimpleType = schemaModel.simpleTypes.get(baseType);

    if (baseComplexType) {
      applyComplexType(node, baseComplexType.element, schemaModel, {
        ...context,
        ancestors: new Set([...context.ancestors, baseType]),
      }, commentOptions);
    } else if (baseSimpleType) {
      node.text = exampleValueForSimpleType(baseSimpleType.element);
    } else if (isBuiltInXsdType(baseType, schemaModel)) {
      node.text = exampleValueForBuiltInType(baseType);
    }
  }

  applyAttributes(node, extensionElement, schemaModel);

  collectChildElementDefinitions(extensionElement).forEach((childElement) => {
    const childName =
      childElement.getAttribute("name") ||
      stripNamespace(childElement.getAttribute("ref"));

    if (!childName || context.ancestors.has(childName)) {
      return;
    }

    node.children.push(
        buildExampleNode(childElement, schemaModel, {
          ...context,
          depth: context.depth + 1,
          ancestors: new Set([...context.ancestors, node.name]),
        }, commentOptions)
      );
  });
}

function applyAttributes(
  node: ExampleXmlNode,
  ownerElement: Element,
  schemaModel: SchemaModel
): void {
  const attributes = Array.from(ownerElement.getElementsByTagName("*")).filter(
    (element) => element.localName === "attribute"
  );

  attributes.forEach((attribute) => {
    const use = attribute.getAttribute("use");
    if (use && use !== "required") {
      return;
    }

    const name =
      attribute.getAttribute("name") || stripNamespace(attribute.getAttribute("ref"));
    if (!name) {
      return;
    }

    const inlineSimpleType = getChildElements(attribute, "simpleType")[0];
    if (inlineSimpleType) {
      node.attributes[name] = exampleValueForSimpleType(inlineSimpleType);
      return;
    }

    const typeName = stripNamespace(attribute.getAttribute("type")) || "string";
    node.attributes[name] = resolveTypeExampleValue(typeName, schemaModel);
  });
}

function buildElementComments(
  elementDefinition: Element,
  schemaModel: SchemaModel,
  elementName: string,
  commentOptions: ExampleXmlCommentOptions
): string[] {
  const comments: string[] = [];
  if (commentOptions.elementNames) {
    comments.push(`Element: ${elementName}`);
  }
  const documentation = getDocumentation(elementDefinition);
  if (documentation && commentOptions.documentation) {
    comments.push(`Documentation: ${documentation}`);
  }

  const minOccurs = elementDefinition.getAttribute("minOccurs");
  const maxOccurs = elementDefinition.getAttribute("maxOccurs");
  if ((minOccurs || maxOccurs) && commentOptions.occurrences) {
    comments.push(`Occurs: ${minOccurs || "1"}..${maxOccurs || "1"}`);
  }

  const typeName = stripNamespace(elementDefinition.getAttribute("type"));
  if (typeName && commentOptions.declaredTypes) {
    comments.push(`Declared type: ${typeName}`);
  }

  const inlineSimpleType = getChildElements(elementDefinition, "simpleType")[0];
  const inlineComplexType = getChildElements(elementDefinition, "complexType")[0];
  const commentOwner = inlineSimpleType || inlineComplexType;

  if (commentOwner) {
    comments.push(...buildAttributeComments(commentOwner, schemaModel, commentOptions));
    return dedupeComments(comments);
  }

  if (typeName) {
    const complexType = schemaModel.complexTypes.get(typeName);
    const simpleType = schemaModel.simpleTypes.get(typeName);
    const resolvedOwner = complexType?.element || simpleType?.element;
    if (resolvedOwner) {
      comments.push(...buildAttributeComments(resolvedOwner, schemaModel, commentOptions));
    }
  }

  return dedupeComments(comments);
}

function buildTypeComments(
  typeElement: Element,
  schemaModel: SchemaModel,
  fallbackLabel: string,
  commentOptions: ExampleXmlCommentOptions
): string[] {
  const comments: string[] = [];
  const typeName = typeElement.getAttribute("name") || fallbackLabel;
  if (commentOptions.resolvedTypes) {
    comments.push(`Resolved schema type: ${typeName}`);
  }

  const documentation = getDocumentation(typeElement);
  if (documentation && commentOptions.documentation) {
    comments.push(`Type documentation: ${documentation}`);
  }

  comments.push(...buildAttributeComments(typeElement, schemaModel, commentOptions));
  comments.push(...buildRestrictionComments(typeElement, commentOptions));

  return dedupeComments(comments);
}

function buildBuiltInTypeComments(
  typeName: string,
  commentOptions: ExampleXmlCommentOptions
): string[] {
  if (!commentOptions.resolvedTypes) {
    return [];
  }

  return [`Resolved built-in XSD type: ${stripNamespace(typeName)}`];
}

function buildAttributeComments(
  ownerElement: Element,
  schemaModel: SchemaModel,
  commentOptions: ExampleXmlCommentOptions
): string[] {
  const attributes = Array.from(ownerElement.getElementsByTagName("*")).filter(
    (element) => element.localName === "attribute"
  );

  if (attributes.length === 0 || (!commentOptions.attributes && !commentOptions.documentation && !commentOptions.restrictions)) {
    return [];
  }

  const requiredAttributes: string[] = [];
  const optionalAttributes: string[] = [];
  const documentationComments: string[] = [];

  attributes.forEach((attribute) => {
    const name =
      attribute.getAttribute("name") || stripNamespace(attribute.getAttribute("ref"));
    if (!name) {
      return;
    }

    const typeName = stripNamespace(attribute.getAttribute("type")) || "string";
    const description = `${name} (${typeName})`;

    if (commentOptions.attributes) {
      if (attribute.getAttribute("use") === "required") {
        requiredAttributes.push(description);
      } else {
        optionalAttributes.push(description);
      }
    }

    const documentation = getDocumentation(attribute);
    if (documentation && commentOptions.documentation) {
      documentationComments.push(`Attribute ${name}: ${documentation}`);
    }

    const inlineSimpleType = getChildElements(attribute, "simpleType")[0];
    if (inlineSimpleType && commentOptions.restrictions) {
      documentationComments.push(
        ...buildRestrictionComments(inlineSimpleType, commentOptions).map(
          (comment) => `${name} ${comment}`
        ),
      );
      return;
    }

    const simpleType = schemaModel.simpleTypes.get(typeName);
    if (simpleType && commentOptions.restrictions) {
      documentationComments.push(
        ...buildRestrictionComments(simpleType.element, commentOptions).map(
          (comment) => `${name} ${comment}`,
        ),
      );
    }
  });

  const comments: string[] = [];
  if (requiredAttributes.length > 0) {
    comments.push(`Required attributes: ${requiredAttributes.join(", ")}`);
  }
  if (optionalAttributes.length > 0) {
    comments.push(`Optional attributes available: ${optionalAttributes.join(", ")}`);
  }

  comments.push(...documentationComments);

  return dedupeComments(comments);
}

function buildRestrictionComments(
  typeElement: Element,
  commentOptions: ExampleXmlCommentOptions
): string[] {
  if (!commentOptions.restrictions) {
    return [];
  }

  const restriction =
    getChildElements(typeElement, "restriction")[0] ||
    getFirstDescendant(typeElement, "restriction");
  if (!restriction) {
    return [];
  }

  const comments: string[] = [];
  const enumerations = getChildElements(restriction, "enumeration")
    .map((enumNode) => enumNode.getAttribute("value"))
    .filter((value): value is string => Boolean(value));

  if (enumerations.length > 0) {
    comments.push(`Allowed values: ${enumerations.join(", ")}`);
  }

  const restrictionParts = ["pattern", "minLength", "maxLength", "minInclusive", "maxInclusive"]
    .map((name) => {
      const node = getChildElements(restriction, name)[0];
      const value = node?.getAttribute("value");
      return value ? `${name}=${value}` : "";
    })
    .filter(Boolean);

  if (restrictionParts.length > 0) {
    comments.push(`Restrictions: ${restrictionParts.join(", ")}`);
  }

  return comments;
}

function dedupeComments(comments: string[]): string[] {
  return Array.from(
    new Set(
      comments
        .map((comment) => comment.trim())
        .filter(Boolean)
    )
  );
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

function exampleValueForSimpleType(simpleTypeElement: Element): string {
  const restriction = getChildElements(simpleTypeElement, "restriction")[0];
  if (!restriction) {
    return "value";
  }

  const enumerations = getChildElements(restriction, "enumeration")
    .map((enumNode) => enumNode.getAttribute("value"))
    .filter((value): value is string => Boolean(value));

  if (enumerations.length > 0) {
    return enumerations[0];
  }

  const baseType = stripNamespace(restriction.getAttribute("base")) || "string";
  return exampleValueForBuiltInType(baseType, restriction);
}

function resolveTypeExampleValue(typeName: string, schemaModel: SchemaModel): string {
  if (isBuiltInXsdType(typeName, schemaModel)) {
    return exampleValueForBuiltInType(typeName);
  }

  const simpleType = schemaModel.simpleTypes.get(typeName);
  if (simpleType) {
    return exampleValueForSimpleType(simpleType.element);
  }

  return "value";
}

function exampleValueForBuiltInType(
  typeName: string,
  restrictionElement: Element | null = null
): string {
  const normalizedType = stripNamespace(typeName).toLowerCase();

  if (restrictionElement) {
    const minLength = getChildElements(restrictionElement, "minLength")[0];
    if (minLength) {
      const length = Number.parseInt(minLength.getAttribute("value") || "", 10);
      if (Number.isFinite(length) && length > 0) {
        return "x".repeat(length);
      }
    }
  }

  switch (normalizedType) {
    case "boolean":
      return "true";
    case "byte":
    case "decimal":
    case "double":
    case "float":
    case "int":
    case "integer":
    case "long":
    case "negativeinteger":
    case "nonnegativeinteger":
    case "nonpositiveinteger":
    case "positiveinteger":
    case "short":
    case "unsignedbyte":
    case "unsignedint":
    case "unsignedlong":
    case "unsignedshort":
      return "1";
    case "date":
      return "2026-01-01";
    case "datetime":
      return "2026-01-01T00:00:00Z";
    case "time":
      return "12:00:00";
    case "duration":
      return "P1D";
    case "anyuri":
      return "https://example.com";
    case "base64binary":
      return "YQ==";
    case "hexbinary":
      return "0A";
    case "gday":
      return "---01";
    case "gmonth":
      return "--01";
    case "gmonthday":
      return "--01-01";
    case "gyear":
      return "2026";
    case "gyearmonth":
      return "2026-01";
    case "qname":
      return "exampleName";
    default:
      return "example";
  }
}

function isBuiltInXsdType(typeName: string, schemaModel: SchemaModel): boolean {
  const normalized = stripNamespace(typeName).toLowerCase();
  const raw = typeName.toLowerCase();

  if (raw.startsWith("xs:") || raw.startsWith("xsd:")) {
    return true;
  }

  return schemaModel.builtInTypes.has(normalized);
}

function stringifyXmlNode(node: ExampleXmlNode, depth = 0): string {
  const indent = "  ".repeat(depth);
  const comments = node.comments
    .flatMap((comment) =>
      comment
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `${indent}<!-- ${escapeXmlComment(line)} -->`)
    )
    .join("\n");
  const attributes = Object.entries(node.attributes)
    .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
    .join("");

  const prefix = comments ? `${comments}\n` : "";

  if (node.children.length === 0 && !node.text) {
    return `${prefix}${indent}<${node.name}${attributes} />`;
  }

  if (node.children.length === 0) {
    return `${prefix}${indent}<${node.name}${attributes}>${escapeXml(node.text)}</${node.name}>`;
  }

  const children = node.children
    .map((child) => stringifyXmlNode(child, depth + 1))
    .join("\n");

  if (node.text) {
    return `${prefix}${indent}<${node.name}${attributes}>${escapeXml(node.text)}\n${children}\n${indent}</${node.name}>`;
  }

  return `${prefix}${indent}<${node.name}${attributes}>\n${children}\n${indent}</${node.name}>`;
}

function escapeXmlComment(value: string): string {
  return value
    .replaceAll("--", "- -")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseVirtualRootFileName(rootValue: string): string | null {
  if (!rootValue.startsWith(`${VIRTUAL_ROOT_VALUE}:`)) {
    return null;
  }

  return rootValue.slice(`${VIRTUAL_ROOT_VALUE}:`.length) || null;
}
