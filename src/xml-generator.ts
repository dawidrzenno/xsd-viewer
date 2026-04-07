import { ALL_NODES_VALUE } from "./constants";
import { escapeXml, getChildElements, stripNamespace } from "./dom-utils";
import type {
  BuildNodeContext,
  ExampleXmlGenerationMode,
  ExampleXmlNode,
  SchemaModel,
} from "./types";

export class ExampleXmlGenerator {
  constructor(
    private readonly schemaModel: SchemaModel,
    private readonly generationMode: ExampleXmlGenerationMode,
    private readonly rootFileName = "",
  ) {}

  generate(rootElementName: string): string {
    if (rootElementName === ALL_NODES_VALUE) {
      return this.generateAllNodesXml(this.rootFileName);
    }

    const rootDefinition = this.schemaModel.elements.get(rootElementName);
    if (!rootDefinition) {
      throw new Error(`Root element "${rootElementName}" was not found`);
    }

    const rootNode = this.buildExampleNode(rootDefinition.element, {
      depth: 0,
      ancestors: new Set(),
      generationMode: this.generationMode,
    });

    if (rootDefinition.targetNamespace) {
      rootNode.attributes["xmlns"] = rootDefinition.targetNamespace;
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      this.stringifyXmlNode(rootNode),
    ].join("\n");
  }

  private generateAllNodesXml(fileName: string): string {
    if (!fileName) {
      throw new Error("A source file must be selected to generate all nodes");
    }

    const topLevelElements = Array.from(this.schemaModel.elements.entries())
      .filter(([, definition]) => definition.fileName === fileName)
      .sort(([left], [right]) => left.localeCompare(right));

    if (topLevelElements.length === 0) {
      throw new Error(`No top-level elements were found for "${fileName}"`);
    }

    const nodes = topLevelElements.map(([, definition]) => {
      const node = this.buildExampleNode(definition.element, {
        depth: 0,
        ancestors: new Set(),
        generationMode: this.generationMode,
      });

      if (definition.targetNamespace) {
        node.attributes["xmlns"] = definition.targetNamespace;
      }

      return this.stringifyXmlNode(node);
    });

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      ...nodes,
    ].join("\n");
  }

  private buildExampleNode(
    elementDefinition: Element,
    context: BuildNodeContext,
  ): ExampleXmlNode {
    const localName = elementDefinition.getAttribute("name");
    const refName = stripNamespace(elementDefinition.getAttribute("ref"));
    const explicitName = localName || refName;

    if (!explicitName) {
      throw new Error("Encountered an element without a usable name");
    }

    if (refName && !localName) {
      const referenced = this.schemaModel.elements.get(refName);
      if (referenced) {
        return this.buildExampleNode(referenced.element, context);
      }
    }

    const node: ExampleXmlNode = {
      name: explicitName,
      attributes: {},
      children: [],
      text: "",
    };

    this.applyAttributes(node, elementDefinition, context.generationMode);

    const inlineComplexType = getChildElements(elementDefinition, "complexType")[0];
    const inlineSimpleType = getChildElements(elementDefinition, "simpleType")[0];
    const typeName = stripNamespace(elementDefinition.getAttribute("type"));

    if (inlineComplexType) {
      this.applyComplexType(node, inlineComplexType, {
        ...context,
        ancestors: new Set([...context.ancestors, explicitName]),
      });
      return node;
    }

    if (inlineSimpleType) {
      node.text = this.exampleValueForSimpleType(inlineSimpleType);
      return node;
    }

    if (typeName) {
      if (this.isBuiltInXsdType(typeName)) {
        node.text = this.exampleValueForBuiltInType(typeName);
        return node;
      }

      const complexType = this.schemaModel.complexTypes.get(typeName);
      if (complexType) {
        this.applyComplexType(node, complexType.element, {
          ...context,
          ancestors: new Set([...context.ancestors, explicitName, typeName]),
        });
        return node;
      }

      const simpleType = this.schemaModel.simpleTypes.get(typeName);
      if (simpleType) {
        node.text = this.exampleValueForSimpleType(simpleType.element);
        return node;
      }
    }

    const childElements = this.collectChildElementDefinitions(elementDefinition, context.generationMode);
    if (childElements.length > 0) {
      childElements.forEach((childElement) => {
        const childName =
          childElement.getAttribute("name") ||
          stripNamespace(childElement.getAttribute("ref"));

        if (!childName || context.ancestors.has(childName)) {
          return;
        }

        node.children.push(
          this.buildExampleNode(childElement, {
            ...context,
            depth: context.depth + 1,
            ancestors: new Set([...context.ancestors, explicitName]),
          }),
        );
      });
      return node;
    }

    node.text = this.exampleValueForBuiltInType("string");
    return node;
  }

  private applyComplexType(
    node: ExampleXmlNode,
    complexTypeElement: Element,
    context: BuildNodeContext,
  ): void {
    this.applyAttributes(node, complexTypeElement, context.generationMode);

    const complexContent = getChildElements(complexTypeElement, "complexContent")[0];
    if (complexContent) {
      const extension = getChildElements(complexContent, "extension")[0];
      const restriction = getChildElements(complexContent, "restriction")[0];
      if (extension) {
        this.applyComplexTypeExtension(node, extension, context);
        return;
      }
      if (restriction) {
        this.applyComplexTypeExtension(node, restriction, context);
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
          node.text = this.resolveTypeExampleValue(baseType);
        }
        this.applyAttributes(node, contentNode, context.generationMode);
        return;
      }
    }

    this.collectChildElementDefinitions(complexTypeElement, context.generationMode).forEach((childElement) => {
      const childName =
        childElement.getAttribute("name") ||
        stripNamespace(childElement.getAttribute("ref"));

      if (!childName || context.ancestors.has(childName)) {
        return;
      }

      node.children.push(
        this.buildExampleNode(childElement, {
          ...context,
          depth: context.depth + 1,
          ancestors: new Set([...context.ancestors, node.name]),
        }),
      );
    });

    if (node.children.length === 0 && !node.text) {
      const inlineSimpleType = getChildElements(complexTypeElement, "simpleType")[0];
      if (inlineSimpleType) {
        node.text = this.exampleValueForSimpleType(inlineSimpleType);
      }
    }
  }

  private applyComplexTypeExtension(
    node: ExampleXmlNode,
    extensionElement: Element,
    context: BuildNodeContext,
  ): void {
    const baseType = stripNamespace(extensionElement.getAttribute("base"));
    if (baseType && !context.ancestors.has(baseType)) {
      const baseComplexType = this.schemaModel.complexTypes.get(baseType);
      const baseSimpleType = this.schemaModel.simpleTypes.get(baseType);

      if (baseComplexType) {
        this.applyComplexType(node, baseComplexType.element, {
          ...context,
          ancestors: new Set([...context.ancestors, baseType]),
        });
      } else if (baseSimpleType) {
        node.text = this.exampleValueForSimpleType(baseSimpleType.element);
      } else if (this.isBuiltInXsdType(baseType)) {
        node.text = this.exampleValueForBuiltInType(baseType);
      }
    }

    this.applyAttributes(node, extensionElement, context.generationMode);

    this.collectChildElementDefinitions(extensionElement, context.generationMode).forEach((childElement) => {
      const childName =
        childElement.getAttribute("name") ||
        stripNamespace(childElement.getAttribute("ref"));

      if (!childName || context.ancestors.has(childName)) {
        return;
      }

      node.children.push(
        this.buildExampleNode(childElement, {
          ...context,
          depth: context.depth + 1,
          ancestors: new Set([...context.ancestors, node.name]),
        }),
      );
    });
  }

  private applyAttributes(
    node: ExampleXmlNode,
    ownerElement: Element,
    generationMode: ExampleXmlGenerationMode,
  ): void {
    const attributes = Array.from(ownerElement.getElementsByTagName("*")).filter(
      (element) => element.localName === "attribute",
    );

    attributes.forEach((attribute) => {
      const use = attribute.getAttribute("use");
      if (generationMode === "minimal" && use && use !== "required") {
        return;
      }

      const name =
        attribute.getAttribute("name") || stripNamespace(attribute.getAttribute("ref"));
      if (!name) {
        return;
      }

      const inlineSimpleType = getChildElements(attribute, "simpleType")[0];
      if (inlineSimpleType) {
        node.attributes[name] = this.exampleValueForSimpleType(inlineSimpleType);
        return;
      }

      const typeName = stripNamespace(attribute.getAttribute("type")) || "string";
      node.attributes[name] = this.resolveTypeExampleValue(typeName);
    });
  }

  private collectChildElementDefinitions(
    ownerElement: Element,
    generationMode: ExampleXmlGenerationMode,
  ): Element[] {
    return this.collectParticleElements(ownerElement, generationMode);
  }

  private collectParticleElements(
    ownerElement: Element,
    generationMode: ExampleXmlGenerationMode,
  ): Element[] {
    const particles: Element[] = [];

    ownerElement.childNodes.forEach((childNode) => {
      if (!(childNode instanceof Element)) {
        return;
      }

      switch (childNode.localName) {
        case "element":
          particles.push(...this.repeatParticle(childNode, generationMode));
          break;
        case "sequence":
        case "all":
          particles.push(...this.repeatGroup(childNode, generationMode, false));
          break;
        case "choice":
          particles.push(...this.repeatGroup(childNode, generationMode, true));
          break;
        default:
          break;
      }
    });

    return particles;
  }

  private repeatGroup(
    groupElement: Element,
    generationMode: ExampleXmlGenerationMode,
    chooseSingleBranch: boolean,
  ): Element[] {
    const childParticles = this.collectParticleElements(groupElement, generationMode);
    if (childParticles.length === 0) {
      return [];
    }

    const groupCount = this.resolveOccursCount(groupElement, generationMode);
    if (groupCount === 0) {
      return [];
    }

    const particlesToRepeat = chooseSingleBranch ? [childParticles[0]] : childParticles;
    const result: Element[] = [];

    for (let index = 0; index < groupCount; index += 1) {
      result.push(...particlesToRepeat);
    }

    return result;
  }

  private repeatParticle(
    elementDefinition: Element,
    generationMode: ExampleXmlGenerationMode,
  ): Element[] {
    const count = this.resolveOccursCount(elementDefinition, generationMode);
    return Array.from({ length: count }, () => elementDefinition);
  }

  private resolveOccursCount(
    element: Element,
    generationMode: ExampleXmlGenerationMode,
  ): number {
    const minOccurs = this.parseOccursValue(element.getAttribute("minOccurs"), 1);

    if (generationMode === "minimal") {
      return minOccurs;
    }

    return Math.min(Math.max(minOccurs, 1), 1);
  }

  private parseOccursValue(value: string | null, fallback: number): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private exampleValueForSimpleType(simpleTypeElement: Element): string {
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
    return this.exampleValueForBuiltInType(baseType, restriction);
  }

  private resolveTypeExampleValue(typeName: string): string {
    if (this.isBuiltInXsdType(typeName)) {
      return this.exampleValueForBuiltInType(typeName);
    }

    const simpleType = this.schemaModel.simpleTypes.get(typeName);
    if (simpleType) {
      return this.exampleValueForSimpleType(simpleType.element);
    }

    return "value";
  }

  private exampleValueForBuiltInType(
    typeName: string,
    restrictionElement: Element | null = null,
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

  private isBuiltInXsdType(typeName: string): boolean {
    const normalized = stripNamespace(typeName).toLowerCase();
    const raw = typeName.toLowerCase();

    if (raw.startsWith("xs:") || raw.startsWith("xsd:")) {
      return true;
    }

    return this.schemaModel.builtInTypes.has(normalized);
  }

  private stringifyXmlNode(node: ExampleXmlNode, depth = 0): string {
    const indent = "  ".repeat(depth);
    const attributes = Object.entries(node.attributes)
      .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
      .join("");

    if (node.children.length === 0 && !node.text) {
      return `${indent}<${node.name}${attributes} />`;
    }

    if (node.children.length === 0) {
      return `${indent}<${node.name}${attributes}>${escapeXml(node.text)}</${node.name}>`;
    }

    const children = node.children
      .map((child) => this.stringifyXmlNode(child, depth + 1))
      .join("\n");

    if (node.text) {
      return `${indent}<${node.name}${attributes}>${escapeXml(node.text)}\n${children}\n${indent}</${node.name}>`;
    }

    return `${indent}<${node.name}${attributes}>\n${children}\n${indent}</${node.name}>`;
  }
}

export function generateExampleXml(
  rootElementName: string,
  schemaModel: SchemaModel,
  rootFileName = "",
  generationMode: ExampleXmlGenerationMode = "minimal",
): string {
  return new ExampleXmlGenerator(
    schemaModel,
    generationMode,
    rootFileName,
  ).generate(rootElementName);
}
