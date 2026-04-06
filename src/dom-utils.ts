export function stripNamespace(name: string | null): string {
  if (!name) {
    return "";
  }

  const parts = name.split(":");
  return parts[parts.length - 1];
}

export function getChildElements(parent: Element | null, localName: string): Element[] {
  if (!parent) {
    return [];
  }

  return Array.from(parent.children).filter((child) => child.localName === localName);
}

export function getDescendantsByLocalName(
  parent: Element | null,
  localName: string
): Element[] {
  if (!parent) {
    return [];
  }

  return Array.from(parent.getElementsByTagName("*")).filter(
    (child) => child.localName === localName
  );
}

export function getFirstDescendant(parent: Element | null, localName: string): Element | null {
  return getDescendantsByLocalName(parent, localName)[0] ?? null;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
