const ATTRIBUTE_PREFIX = '@';
const TEXT_NODE_KEY = '#text';
const SYNTHETIC_ROOT_NAME = 'root';

export function convertXmlToJson(xml: string): string {
  const normalizedXml = xml.replace(/^\s*<\?xml[^?]*\?>\s*/i, '').trim();
  if (!normalizedXml) {
    return '';
  }

  const parser = new DOMParser();
  const wrappedXml = `<${SYNTHETIC_ROOT_NAME}>${normalizedXml}</${SYNTHETIC_ROOT_NAME}>`;
  const document = parser.parseFromString(wrappedXml, 'text/xml');
  const parserError = document.querySelector('parsererror');
  if (parserError) {
    throw new Error(parserError.textContent?.trim() || 'Invalid XML');
  }

  const rootElement = document.documentElement;
  if (!rootElement) {
    return '';
  }

  return JSON.stringify(convertElement(rootElement), null, 2);
}

function convertElement(element: Element): JsonValue {
  const attributes = Array.from(element.attributes).reduce<Record<string, JsonValue>>(
    (accumulator, attribute) => {
      accumulator[`${ATTRIBUTE_PREFIX}${attribute.name}`] = attribute.value;
      return accumulator;
    },
    {},
  );

  const childElements = Array.from(element.children);
  const textNodes = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent?.trim() || '')
    .filter(Boolean);

  if (childElements.length === 0) {
    if (Object.keys(attributes).length === 0) {
      return textNodes[0] ?? '';
    }

    if (textNodes.length > 0) {
      attributes[TEXT_NODE_KEY] = textNodes.join(' ');
    }

    return attributes;
  }

  const groupedChildren = childElements.reduce<Record<string, JsonValue>>((accumulator, child) => {
    const childValue = convertElement(child);
    const existingValue = accumulator[child.nodeName];

    if (existingValue === undefined) {
      accumulator[child.nodeName] = childValue;
      return accumulator;
    }

    accumulator[child.nodeName] = Array.isArray(existingValue)
      ? [...existingValue, childValue]
      : [existingValue, childValue];

    return accumulator;
  }, {});

  if (textNodes.length > 0) {
    groupedChildren[TEXT_NODE_KEY] = textNodes.join(' ');
  }

  return {
    ...attributes,
    ...groupedChildren,
  };
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}
