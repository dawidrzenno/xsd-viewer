export interface HandbookCard {
  title: string;
  code: string;
  note: string;
}

export interface HandbookSection {
  title: string;
  cards: HandbookCard[];
}

export const XML_HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    title: 'Document Structure',
    cards: [
      {
        title: 'XML Declaration',
        code: '<?xml version="1.0" encoding="UTF-8"?>',
        note: 'Optional but common first line. It declares XML version and encoding.',
      },
      {
        title: 'Root Element',
        code: '<invoice>\n  <number>INV-1</number>\n</invoice>',
        note: 'Every XML document must have exactly one root element containing everything else.',
      },
      {
        title: 'Simple Element',
        code: '<customer>Alice</customer>',
        note: 'A standard element with text content between the opening and closing tags.',
      },
      {
        title: 'Attributes',
        code: '<customer id="123" active="true">Alice</customer>',
        note: 'Attributes belong in the opening tag. They are often used for identifiers, flags, and metadata.',
      },
      {
        title: 'Nested Elements',
        code: '<order>\n  <id>42</id>\n  <customer>\n    <name>Alice</name>\n  </customer>\n</order>',
        note: 'Elements can contain child elements, which form the document tree.',
      },
      {
        title: 'Repeated Siblings',
        code: '<items>\n  <item>Coffee</item>\n  <item>Tea</item>\n  <item>Water</item>\n</items>',
        note: 'Schemas often allow repeated sibling elements with maxOccurs.',
      },
      {
        title: 'Empty Element',
        code: '<attachment />',
        note: 'Use self-closing syntax when the element has no text or children.',
      },
    ],
  },
  {
    title: 'Namespaces And Metadata',
    cards: [
      {
        title: 'Default Namespace',
        code: '<invoice xmlns="urn:example:invoice">\n  <number>INV-1</number>\n</invoice>',
        note: 'xmlns declares the default namespace for the current element and its descendants.',
      },
      {
        title: 'Prefixed Namespace',
        code: '<doc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n     xsi:schemaLocation="urn:example invoice.xsd">\n  <title>Example</title>\n</doc>',
        note: 'Prefixes are commonly used for xsi attributes and mixed vocabularies.',
      },
      {
        title: 'Comment',
        code: '<!-- Internal note: generated from test schema -->',
        note: 'Comments are allowed almost anywhere, but the text cannot contain --.',
      },
      {
        title: 'Processing Instruction',
        code: '<?xml-stylesheet type="text/xsl" href="view.xsl"?>',
        note: 'Processing instructions pass directives to tools, not to the schema itself.',
      },
    ],
  },
  {
    title: 'Text And Content Rules',
    cards: [
      {
        title: 'Escaping Text',
        code: '<text>Tom &amp; Jerry &lt;3</text>',
        note: 'Escape special characters like &, <, > inside text.',
      },
      {
        title: 'CDATA Section',
        code: '<script><![CDATA[\nif (a < b) {\n  console.log("raw content");\n}\n]]></script>',
        note: 'CDATA keeps content unescaped, except that the sequence ]]> cannot appear inside it.',
      },
      {
        title: 'Mixed Content',
        code: '<paragraph>\n  Use <emphasis>strong</emphasis> formatting.\n</paragraph>',
        note: 'Text and child elements can coexist when the schema allows mixed content.',
      },
      {
        title: 'Common Scalar Values',
        code: '<flag>true</flag>\n<count>3</count>\n<date>2026-04-07</date>\n<timestamp>2026-04-07T12:00:00Z</timestamp>',
        note: 'Typical XSD scalar formats include booleans, numbers, ISO dates, and datetimes.',
      },
    ],
  },
  {
    title: 'Validation And XSD Habits',
    cards: [
      {
        title: 'Order Matters',
        code: '<person>\n  <firstName>Alice</firstName>\n  <lastName>Nguyen</lastName>\n</person>',
        note: 'In many XSD sequences, element order must match the schema exactly.',
      },
      {
        title: 'Optional vs Required',
        code: '<user role="admin">\n  <name>Alice</name>\n  <email>alice@example.com</email>\n</user>',
        note: 'Required attributes and elements must be present. Optional ones depend on schema constraints.',
      },
      {
        title: 'Validation Mindset',
        code: '<invoice status="draft">\n  <number>INV-1</number>\n</invoice>',
        note: 'To satisfy an XSD, watch element names, order, cardinality, namespaces, and attribute requirements together.',
      },
    ],
  },
];

export const XSD_HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    title: 'Schema Structure',
    cards: [
      {
        title: 'Schema Root',
        code: '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">\n  ...\n</xs:schema>',
        note: 'Every XSD starts with xs:schema and usually declares the XML Schema namespace.',
      },
      {
        title: 'Target Namespace',
        code: '<xs:schema\n  xmlns:xs="http://www.w3.org/2001/XMLSchema"\n  targetNamespace="urn:example:invoice"\n  elementFormDefault="qualified">\n  ...\n</xs:schema>',
        note: 'Use targetNamespace to define the schema vocabulary and elementFormDefault to control qualification.',
      },
      {
        title: 'Top-Level Element',
        code: '<xs:element name="invoice" type="InvoiceType" />',
        note: 'Global elements are common document entry points and can be referenced elsewhere.',
      },
    ],
  },
  {
    title: 'Types And Constraints',
    cards: [
      {
        title: 'Complex Type',
        code: '<xs:complexType name="InvoiceType">\n  <xs:sequence>\n    <xs:element name="number" type="xs:string" />\n    <xs:element name="total" type="xs:decimal" />\n  </xs:sequence>\n</xs:complexType>',
        note: 'Use complex types for elements that contain child elements or attributes.',
      },
      {
        title: 'Simple Type Restriction',
        code: '<xs:simpleType name="StatusType">\n  <xs:restriction base="xs:string">\n    <xs:enumeration value="draft" />\n    <xs:enumeration value="final" />\n  </xs:restriction>\n</xs:simpleType>',
        note: 'Restrictions narrow base types by enumeration, pattern, numeric bounds, length, and more.',
      },
      {
        title: 'Attribute Declaration',
        code: '<xs:attribute name="currency" type="xs:string" use="required" />',
        note: 'Attributes can be optional or required. Use them for metadata rather than nested structure.',
      },
      {
        title: 'Pattern Constraint',
        code: '<xs:simpleType name="CodeType">\n  <xs:restriction base="xs:string">\n    <xs:pattern value="[A-Z]{3}-[0-9]{2}" />\n  </xs:restriction>\n</xs:simpleType>',
        note: 'Patterns apply regular-expression-like matching to textual values.',
      },
    ],
  },
  {
    title: 'Composition And Reuse',
    cards: [
      {
        title: 'Sequence',
        code: '<xs:sequence>\n  <xs:element name="firstName" type="xs:string" />\n  <xs:element name="lastName" type="xs:string" />\n</xs:sequence>',
        note: 'A sequence enforces element order exactly as declared.',
      },
      {
        title: 'Choice',
        code: '<xs:choice>\n  <xs:element name="email" type="xs:string" />\n  <xs:element name="phone" type="xs:string" />\n</xs:choice>',
        note: 'A choice means only one of the alternatives is expected unless occurrence rules say otherwise.',
      },
      {
        title: 'Occurrences',
        code: '<xs:element\n  name="item"\n  type="ItemType"\n  minOccurs="0"\n  maxOccurs="unbounded" />',
        note: 'Use minOccurs and maxOccurs to express optional, required, and repeating content.',
      },
      {
        title: 'Extension',
        code: '<xs:complexContent>\n  <xs:extension base="BasePartyType">\n    <xs:sequence>\n      <xs:element name="taxId" type="xs:string" />\n    </xs:sequence>\n  </xs:extension>\n</xs:complexContent>',
        note: 'Extensions let one type inherit another and add more content.',
      },
    ],
  },
  {
    title: 'Validation And Design Habits',
    cards: [
      {
        title: 'Reference Vs Inline',
        code: '<xs:element ref="common:address" />\n\n<xs:element name="address">\n  <xs:complexType>...</xs:complexType>\n</xs:element>',
        note: 'Use global reusable definitions when many elements share the same shape.',
      },
      {
        title: 'Required Thinking',
        code: '<xs:element name="id" type="xs:string" />\n<xs:attribute name="status" type="StatusType" use="required" />',
        note: 'Ask which parts are mandatory, repeatable, ordered, namespaced, and constrained before writing example XML.',
      },
      {
        title: 'Documentation',
        code: '<xs:annotation>\n  <xs:documentation>\n    Human-readable guidance for schema users.\n  </xs:documentation>\n</xs:annotation>',
        note: 'Annotations make large schemas much easier to understand and maintain.',
      },
      {
        title: 'Validation Mindset',
        code: '<xs:element name="invoice" type="InvoiceType" />\n<xs:complexType name="InvoiceType">...</xs:complexType>',
        note: 'To validate successfully, align names, order, cardinality, namespaces, base types, and restrictions together.',
      },
    ],
  },
];
