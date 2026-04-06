class TreeViewer {
  constructor(container) {
    this.container = container;
    this.loadedDocs = [];
    this.schemaModel = this.createEmptySchemaModel();
    this.exampleXml = "";

    this.addSearchBar();
    this.addControlButtons();
    this.addExampleXmlPanel();
  }

  createEmptySchemaModel() {
    return {
      docs: [],
      elements: new Map(),
      complexTypes: new Map(),
      simpleTypes: new Map(),
      namespaces: new Map(),
      builtInTypes: new Set([
        "anyuri",
        "base64binary",
        "boolean",
        "byte",
        "date",
        "datetime",
        "decimal",
        "double",
        "duration",
        "float",
        "gday",
        "gmonth",
        "gmonthday",
        "gyear",
        "gyearmonth",
        "hexbinary",
        "int",
        "integer",
        "long",
        "name",
        "ncname",
        "negativeinteger",
        "nmtoken",
        "nonnegativeinteger",
        "nonpositiveinteger",
        "normalizedstring",
        "positiveinteger",
        "qname",
        "short",
        "string",
        "time",
        "token",
        "unsignedbyte",
        "unsignedint",
        "unsignedlong",
        "unsignedshort",
      ]),
    };
  }

  async parseXSDFiles(files) {
    try {
      this.showLoading();
      const parser = new DOMParser();
      const xsdDocs = [];

      for (const file of files) {
        try {
          const text = await file.text();
          const doc = parser.parseFromString(text, "text/xml");

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

      this.loadedDocs = xsdDocs;
      this.schemaModel = this.buildSchemaModel(xsdDocs);

      const processedData = this.processXSDDocs(xsdDocs);
      this.renderTree(processedData);
      this.renderExampleXml("");
      this.populateRootSelector();
    } catch (error) {
      console.error("Error parsing files:", error);
      this.showError(error.message || "Could not parse XSD files");
    } finally {
      this.hideLoading();
      this.toggleAll(true);
    }
  }

  buildSchemaModel(docs) {
    const model = this.createEmptySchemaModel();
    model.docs = docs;

    for (const { doc, name } of docs) {
      const schemaElement = doc.documentElement;
      if (!schemaElement) {
        continue;
      }

      const targetNamespace = schemaElement.getAttribute("targetNamespace") || "";
      model.namespaces.set(name, targetNamespace);

      this.getChildElements(schemaElement, "element").forEach((element) => {
        const elementName = element.getAttribute("name");
        if (elementName) {
          model.elements.set(elementName, {
            element,
            fileName: name,
            targetNamespace,
          });
        }
      });

      this.getDescendantsByLocalName(schemaElement, "complexType").forEach(
        (typeElement) => {
          const typeName = typeElement.getAttribute("name");
          if (typeName) {
            model.complexTypes.set(typeName, {
              element: typeElement,
              fileName: name,
              targetNamespace,
            });
          }
        }
      );

      this.getDescendantsByLocalName(schemaElement, "simpleType").forEach(
        (typeElement) => {
          const typeName = typeElement.getAttribute("name");
          if (typeName) {
            model.simpleTypes.set(typeName, {
              element: typeElement,
              fileName: name,
              targetNamespace,
            });
          }
        }
      );
    }

    return model;
  }

  processXSDDocs(docs) {
    if (!Array.isArray(docs)) {
      console.error("Expected array of docs, got:", docs);
      return [];
    }

    const types = [];

    for (const { doc, name } of docs) {
      if (!doc || !name) {
        console.error("Invalid doc object:", { doc, name });
        continue;
      }

      types.push(...this.processSimpleTypes(doc, name));
      types.push(...this.processComplexTypes(doc, name));
      types.push(...this.processElements(doc, name));
    }

    return types;
  }

  processSimpleTypes(doc, fileName) {
    return this.getDescendantsByLocalName(doc.documentElement, "simpleType")
      .map((typeElement) => this.processType(typeElement, "simpleType", fileName))
      .filter(Boolean);
  }

  processComplexTypes(doc, fileName) {
    return this.getDescendantsByLocalName(doc.documentElement, "complexType")
      .map((typeElement) =>
        this.processType(typeElement, "complexType", fileName)
      )
      .filter(Boolean);
  }

  processElements(doc, fileName) {
    return this.getChildElements(doc.documentElement, "element")
      .map((elementElement) => this.processType(elementElement, "element", fileName))
      .filter(Boolean);
  }

  processType(typeElement, typeKind, fileName) {
    const name = typeElement.getAttribute("name");
    if (!name) {
      return null;
    }

    const children = [];
    const documentation = this.getDocumentation(typeElement);
    const restrictions = this.getRestrictions(typeElement);
    const attributes = this.getAttributes(typeElement);

    this.getDescendantsByLocalName(typeElement, "enumeration").forEach((enum_) => {
      const value = enum_.getAttribute("value");
      if (!value) {
        return;
      }

      children.push({
        name: value,
        type: "enumeration",
        documentation: this.getDocumentation(enum_),
      });
    });

    this.getNestedElementSummaries(typeElement).forEach((elementSummary) => {
      children.push(elementSummary);
    });

    const extension = this.getFirstDescendant(typeElement, "extension");
    if (extension) {
      const extensionData = this.processComplexContentExtension(extension, fileName);
      if (extensionData) {
        children.push(extensionData);
      }
    }

    return {
      name,
      type: typeKind,
      documentation,
      restrictions,
      attributes,
      children,
      fileName,
    };
  }

  getNestedElementSummaries(root) {
    const directContainers = ["sequence", "choice", "all", "complexType", "group"];
    const summaries = [];

    directContainers.forEach((tagName) => {
      this.getChildElements(root, tagName).forEach((container) => {
        this.getChildElements(container, "element").forEach((element) => {
          const elementName = element.getAttribute("name") || element.getAttribute("ref");
          if (!elementName) {
            return;
          }

          summaries.push({
            name: this.stripNamespace(elementName),
            type: element.getAttribute("type") || "element",
            documentation: this.getDocumentation(element),
            minOccurs: element.getAttribute("minOccurs"),
            maxOccurs: element.getAttribute("maxOccurs"),
          });
        });
      });
    });

    return summaries;
  }

  getDocumentation(element) {
    const annotation = this.getChildElements(element, "annotation")[0];
    const documentation = annotation
      ? this.getChildElements(annotation, "documentation")[0]
      : null;
    return documentation ? documentation.textContent.trim() : "";
  }

  getRestrictions(element) {
    const restrictions = {};
    const restriction = this.getFirstDescendant(element, "restriction");

    if (!restriction) {
      return null;
    }

    const base = restriction.getAttribute("base");
    if (base) {
      restrictions.base = base;
    }

    ["minLength", "maxLength", "pattern", "minInclusive", "maxInclusive"].forEach(
      (attr) => {
        const restrictionNode = this.getChildElements(restriction, attr)[0];
        if (restrictionNode) {
          restrictions[attr] = restrictionNode.getAttribute("value");
        }
      }
    );

    return Object.keys(restrictions).length ? restrictions : null;
  }

  getAttributes(element) {
    const attributes = this.getDescendantsByLocalName(element, "attribute")
      .map((attr) => ({
        name: attr.getAttribute("name") || this.stripNamespace(attr.getAttribute("ref")),
        type: attr.getAttribute("type"),
        use: attr.getAttribute("use"),
        documentation: this.getDocumentation(attr),
      }))
      .filter((attr) => attr.name);

    return attributes.length ? attributes : null;
  }

  createNodeElement(node) {
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "tree-node";

    const contentDiv = document.createElement("div");
    contentDiv.className = "node-content";

    const childrenDiv = document.createElement("div");
    childrenDiv.className = "children hidden";

    if (node.children && node.children.length > 0) {
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

    if (node.type) {
      const typeSpan = document.createElement("span");
      typeSpan.className = "node-type";
      typeSpan.textContent = node.type;
      nameTypeDiv.appendChild(typeSpan);
    }

    nodeInfo.appendChild(nameTypeDiv);

    if (node.fileName || node.minOccurs || node.maxOccurs) {
      const metadataDiv = document.createElement("div");
      metadataDiv.className = "metadata";
      const metadata = [];
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

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        childrenDiv.appendChild(this.createNodeElement(child));
      });
      nodeDiv.appendChild(childrenDiv);
    }

    return nodeDiv;
  }

  renderTree(types) {
    if (!Array.isArray(types)) {
      console.error("Expected array of types, got:", types);
      return;
    }

    this.container.innerHTML = "";

    const typesByFile = types.reduce((acc, type) => {
      const fileName = type.fileName || "Unknown File";
      if (!acc[fileName]) {
        acc[fileName] = [];
      }
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

      fileTypes.forEach((type) => {
        fileSection.appendChild(this.createNodeElement(type));
      });

      this.container.appendChild(fileSection);
    });
  }

  showLoading() {
    const existingLoader = document.querySelector(".loader");
    if (existingLoader) {
      existingLoader.remove();
    }

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

  hideLoading() {
    const loader = document.querySelector(".loader");
    if (loader) {
      loader.remove();
    }
  }

  showError(message) {
    const existingError = document.querySelector(".error-message");
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    this.container.prepend(errorDiv);

    setTimeout(() => errorDiv.remove(), 5000);
  }

  addSearchBar() {
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

    const header = document.querySelector("header");
    header.querySelector(".header-content").appendChild(searchDiv);

    document.getElementById("schemaSearch").addEventListener("input", (event) => {
      this.filterNodes(event.target.value.toLowerCase());
    });
  }

  filterNodes(searchTerm) {
    const allNodes = document.querySelectorAll(".tree-node");

    allNodes.forEach((node) => {
      const nodeName = node.querySelector(".node-name")?.textContent.toLowerCase() || "";
      const nodeType = node.querySelector(".node-type")?.textContent.toLowerCase() || "";
      const documentation =
        node.querySelector(".documentation")?.textContent.toLowerCase() || "";

      const matches =
        nodeName.includes(searchTerm) ||
        nodeType.includes(searchTerm) ||
        documentation.includes(searchTerm);

      node.style.display = matches ? "" : "none";
    });
  }

  addControlButtons() {
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "control-buttons";
    buttonContainer.innerHTML = `
      <button class="control-btn" id="expandAll" type="button">Expand All</button>
      <button class="control-btn" id="collapseAll" type="button">Collapse All</button>
    `;

    const searchContainer = document.querySelector(".search-container");
    searchContainer.appendChild(buttonContainer);

    document.getElementById("expandAll").onclick = () => this.toggleAll(true);
    document.getElementById("collapseAll").onclick = () => this.toggleAll(false);
  }

  addExampleXmlPanel() {
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
          <button id="generateXml" class="control-btn" type="button">
            Generate Example XML
          </button>
          <button id="copyXml" class="control-btn" type="button">
            Copy XML
          </button>
        </div>
      </div>
      <pre id="exampleXmlOutput" class="example-output">Load one or more XSD files to generate example XML.</pre>
    `;

    this.container.parentNode.insertBefore(panel, this.container);

    document.getElementById("generateXml").addEventListener("click", () => {
      this.handleGenerateExampleXml();
    });

    document.getElementById("copyXml").addEventListener("click", async () => {
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

  populateRootSelector() {
    const select = document.getElementById("rootElementSelect");
    if (!select) {
      return;
    }

    const rootNames = Array.from(this.schemaModel.elements.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    select.innerHTML = `
      <option value="">Choose root element</option>
      ${rootNames
        .map((name) => `<option value="${name}">${name}</option>`)
        .join("")}
    `;

    if (rootNames.length === 1) {
      select.value = rootNames[0];
      this.handleGenerateExampleXml();
    }
  }

  handleGenerateExampleXml() {
    const select = document.getElementById("rootElementSelect");
    const rootName = select?.value;

    if (!rootName) {
      this.renderExampleXml("Choose a root element to generate XML.");
      return;
    }

    try {
      const xml = this.generateExampleXml(rootName);
      this.exampleXml = xml;
      this.renderExampleXml(xml);
    } catch (error) {
      console.error("Could not generate example XML:", error);
      this.renderExampleXml(
        `Could not generate example XML: ${error.message || "Unknown error"}`
      );
    }
  }

  renderExampleXml(content) {
    const output = document.getElementById("exampleXmlOutput");
    if (output) {
      output.textContent = content || "Load one or more XSD files to generate example XML.";
    }
  }

  generateExampleXml(rootElementName) {
    const rootDefinition = this.schemaModel.elements.get(rootElementName);
    if (!rootDefinition) {
      throw new Error(`Root element "${rootElementName}" was not found`);
    }

    const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
    const rootNode = this.buildExampleNode(rootDefinition.element, {
      depth: 0,
      ancestors: new Set(),
    });

    if (rootDefinition.targetNamespace) {
      rootNode.attributes.xmlns = rootDefinition.targetNamespace;
    }

    lines.push(this.stringifyXmlNode(rootNode));
    return lines.join("\n");
  }

  buildExampleNode(elementDefinition, context) {
    const localName = elementDefinition.getAttribute("name");
    const refName = this.stripNamespace(elementDefinition.getAttribute("ref"));
    const explicitName = localName || refName;

    if (!explicitName) {
      throw new Error("Encountered an element without a usable name");
    }

    const node = {
      name: explicitName,
      attributes: {},
      children: [],
      text: "",
    };

    if (refName && !localName) {
      const referenced = this.schemaModel.elements.get(refName);
      if (referenced) {
        return this.buildExampleNode(referenced.element, context);
      }
    }

    this.applyAttributes(node, elementDefinition);

    const inlineComplexType = this.getChildElements(elementDefinition, "complexType")[0];
    const inlineSimpleType = this.getChildElements(elementDefinition, "simpleType")[0];
    const typeName = this.stripNamespace(elementDefinition.getAttribute("type"));

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

    const childElements = this.collectChildElementDefinitions(elementDefinition);
    if (childElements.length) {
      childElements.forEach((childElement) => {
        const childName =
          childElement.getAttribute("name") ||
          this.stripNamespace(childElement.getAttribute("ref"));

        if (!childName || context.ancestors.has(childName)) {
          return;
        }

        node.children.push(
          this.buildExampleNode(childElement, {
            ...context,
            depth: context.depth + 1,
            ancestors: new Set([...context.ancestors, explicitName]),
          })
        );
      });
      return node;
    }

    node.text = this.exampleValueForBuiltInType("string");
    return node;
  }

  applyComplexType(node, complexTypeElement, context) {
    this.applyAttributes(node, complexTypeElement);

    const complexContent = this.getChildElements(complexTypeElement, "complexContent")[0];
    if (complexContent) {
      const extension = this.getChildElements(complexContent, "extension")[0];
      const restriction = this.getChildElements(complexContent, "restriction")[0];

      if (extension) {
        this.applyComplexTypeExtension(node, extension, context);
        return;
      }

      if (restriction) {
        this.applyComplexTypeExtension(node, restriction, context);
        return;
      }
    }

    const simpleContent = this.getChildElements(complexTypeElement, "simpleContent")[0];
    if (simpleContent) {
      const extension = this.getChildElements(simpleContent, "extension")[0];
      const restriction = this.getChildElements(simpleContent, "restriction")[0];
      const contentNode = extension || restriction;

      if (contentNode) {
        const baseType = this.stripNamespace(contentNode.getAttribute("base"));
        if (baseType) {
          node.text = this.resolveTypeExampleValue(baseType);
        }
        this.applyAttributes(node, contentNode);
        return;
      }
    }

    this.collectChildElementDefinitions(complexTypeElement).forEach((childElement) => {
      const childName =
        childElement.getAttribute("name") ||
        this.stripNamespace(childElement.getAttribute("ref"));

      if (!childName || context.ancestors.has(childName)) {
        return;
      }

      node.children.push(
        this.buildExampleNode(childElement, {
          ...context,
          depth: context.depth + 1,
          ancestors: new Set([...context.ancestors, node.name]),
        })
      );
    });

    if (node.children.length === 0 && !node.text) {
      const inlineSimpleType = this.getChildElements(complexTypeElement, "simpleType")[0];
      if (inlineSimpleType) {
        node.text = this.exampleValueForSimpleType(inlineSimpleType);
      }
    }
  }

  applyComplexTypeExtension(node, extensionElement, context) {
    const baseType = this.stripNamespace(extensionElement.getAttribute("base"));
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

    this.applyAttributes(node, extensionElement);

    this.collectChildElementDefinitions(extensionElement).forEach((childElement) => {
      const childName =
        childElement.getAttribute("name") ||
        this.stripNamespace(childElement.getAttribute("ref"));

      if (!childName || context.ancestors.has(childName)) {
        return;
      }

      node.children.push(
        this.buildExampleNode(childElement, {
          ...context,
          depth: context.depth + 1,
          ancestors: new Set([...context.ancestors, node.name]),
        })
      );
    });
  }

  applyAttributes(node, ownerElement) {
    this.getDescendantsByLocalName(ownerElement, "attribute").forEach((attribute) => {
      const use = attribute.getAttribute("use");
      if (use && use !== "required") {
        return;
      }

      const name =
        attribute.getAttribute("name") ||
        this.stripNamespace(attribute.getAttribute("ref"));

      if (!name) {
        return;
      }

      const inlineSimpleType = this.getChildElements(attribute, "simpleType")[0];
      if (inlineSimpleType) {
        node.attributes[name] = this.exampleValueForSimpleType(inlineSimpleType);
        return;
      }

      const typeName = this.stripNamespace(attribute.getAttribute("type")) || "string";
      node.attributes[name] = this.resolveTypeExampleValue(typeName);
    });
  }

  collectChildElementDefinitions(ownerElement) {
    const groups = ["sequence", "choice", "all"];
    const childElements = [];

    groups.forEach((groupName) => {
      this.getChildElements(ownerElement, groupName).forEach((group) => {
        const directElements = this.getChildElements(group, "element");
        if (groupName === "choice" && directElements.length > 0) {
          childElements.push(directElements[0]);
        } else {
          childElements.push(...directElements);
        }
      });
    });

    return childElements;
  }

  exampleValueForSimpleType(simpleTypeElement) {
    const restriction = this.getChildElements(simpleTypeElement, "restriction")[0];
    if (!restriction) {
      return "value";
    }

    const enumerations = this.getChildElements(restriction, "enumeration")
      .map((enumNode) => enumNode.getAttribute("value"))
      .filter(Boolean);

    if (enumerations.length > 0) {
      return enumerations[0];
    }

    const baseType = this.stripNamespace(restriction.getAttribute("base")) || "string";
    return this.exampleValueForBuiltInType(baseType, restriction);
  }

  resolveTypeExampleValue(typeName) {
    if (this.isBuiltInXsdType(typeName)) {
      return this.exampleValueForBuiltInType(typeName);
    }

    const simpleType = this.schemaModel.simpleTypes.get(typeName);
    if (simpleType) {
      return this.exampleValueForSimpleType(simpleType.element);
    }

    return "value";
  }

  exampleValueForBuiltInType(typeName, restrictionElement = null) {
    const normalizedType = this.stripNamespace(typeName).toLowerCase();

    if (restrictionElement) {
      const minLength = this.getChildElements(restrictionElement, "minLength")[0];
      if (minLength) {
        const length = Number.parseInt(minLength.getAttribute("value"), 10);
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

  isBuiltInXsdType(typeName) {
    if (!typeName) {
      return false;
    }

    const normalized = this.stripNamespace(typeName).toLowerCase();
    const raw = typeName.toLowerCase();

    if (raw.startsWith("xs:") || raw.startsWith("xsd:")) {
      return true;
    }

    return this.schemaModel.builtInTypes.has(normalized);
  }

  stringifyXmlNode(node, depth = 0) {
    const indent = "  ".repeat(depth);
    const attributes = Object.entries(node.attributes)
      .map(([name, value]) => ` ${name}="${this.escapeXml(value)}"`)
      .join("");

    if (node.children.length === 0 && !node.text) {
      return `${indent}<${node.name}${attributes} />`;
    }

    if (node.children.length === 0) {
      return `${indent}<${node.name}${attributes}>${this.escapeXml(
        node.text
      )}</${node.name}>`;
    }

    const children = node.children
      .map((child) => this.stringifyXmlNode(child, depth + 1))
      .join("\n");

    if (node.text) {
      return `${indent}<${node.name}${attributes}>${this.escapeXml(
        node.text
      )}\n${children}\n${indent}</${node.name}>`;
    }

    return `${indent}<${node.name}${attributes}>\n${children}\n${indent}</${node.name}>`;
  }

  toggleAll(expand) {
    const toggleButtons = document.querySelectorAll(".toggle-btn");
    const childrenDivs = document.querySelectorAll(".children");

    toggleButtons.forEach((btn) => {
      btn.classList.toggle("open", expand);
    });

    childrenDivs.forEach((div) => {
      div.classList.toggle("hidden", !expand);
    });
  }

  stripNamespace(name) {
    if (!name) {
      return "";
    }

    const parts = name.split(":");
    return parts[parts.length - 1];
  }

  getChildElements(parent, localName) {
    if (!parent) {
      return [];
    }

    return Array.from(parent.children || []).filter(
      (child) => child.localName === localName
    );
  }

  getDescendantsByLocalName(parent, localName) {
    if (!parent) {
      return [];
    }

    return Array.from(parent.getElementsByTagName("*")).filter(
      (child) => child.localName === localName
    );
  }

  getFirstDescendant(parent, localName) {
    return this.getDescendantsByLocalName(parent, localName)[0] || null;
  }

  processComplexContentExtension(extensionElement, fileName) {
    const name = this.stripNamespace(extensionElement.getAttribute("base"));
    if (!name) {
      return null;
    }

    return {
      name,
      type: "complexContent",
      baseType: name,
      children: this.collectChildElementDefinitions(extensionElement).map((element) => ({
        name:
          element.getAttribute("name") ||
          this.stripNamespace(element.getAttribute("ref")),
        type: element.getAttribute("type") || "element",
        documentation: this.getDocumentation(element),
        minOccurs: element.getAttribute("minOccurs"),
        maxOccurs: element.getAttribute("maxOccurs"),
      })),
      fileName,
    };
  }

  escapeXml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }
}

const viewer = new TreeViewer(document.getElementById("treeViewer"));

document.getElementById("xsdFile").addEventListener("change", (event) => {
  const files = event.target.files;
  if (files.length > 0) {
    viewer.parseXSDFiles(files);
  }
});
