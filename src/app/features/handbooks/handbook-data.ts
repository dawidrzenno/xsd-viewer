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
    title: 'Document Skeleton',
    cards: [
      {
        title: 'XML Declaration',
        code: '<?xml version="1.0" encoding="UTF-8"?>',
        note: 'Optional prolog line that declares XML version and encoding. It must appear before the root element if used.',
      },
      {
        title: 'Root Element',
        code: '<invoice>\n  <number>INV-1</number>\n</invoice>',
        note: 'Every XML document must have exactly one root element. Everything else in the document is nested inside it.',
      },
      {
        title: 'Start Tag',
        code: '<invoice>',
        note: 'An opening tag begins an element. It may carry attributes and namespace declarations.',
      },
      {
        title: 'End Tag',
        code: '</invoice>',
        note: 'A closing tag ends a non-empty element and must match the opening tag name exactly.',
      },
      {
        title: 'Empty Element Tag',
        code: '<attachment />',
        note: 'Self-closing syntax for an element with no child elements and no text content.',
      },
      {
        title: 'Simple Element Content',
        code: '<customer>Alice</customer>',
        note: 'An element can contain character data between its start and end tags.',
      },
      {
        title: 'Nested Element Structure',
        code: '<order>\n  <id>42</id>\n  <customer>\n    <name>Alice</name>\n  </customer>\n</order>',
        note: 'Elements can contain child elements, which creates the document tree seen by parsers and validators.',
      },
    ],
  },
  {
    title: 'Nodes And Markup',
    cards: [
      {
        title: 'Attribute',
        code: '<customer id="123" active="true">Alice</customer>',
        note: 'Name-value pair inside a start tag. Attributes hold scalar metadata rather than nested structure.',
      },
      {
        title: 'Text Node',
        code: '<message>Hello world</message>',
        note: 'Character data between tags becomes text content. It is distinct from child elements and attributes.',
      },
      {
        title: 'Comment',
        code: '<!-- Internal note: generated from test schema -->',
        note: 'Comments can appear in most places outside markup boundaries. The text may not contain `--`.',
      },
      {
        title: 'Processing Instruction',
        code: '<?xml-stylesheet type="text/xsl" href="view.xsl"?>',
        note: 'Instruction to an application or processor. It is not part of the element tree itself.',
      },
      {
        title: 'CDATA Section',
        code: '<script><![CDATA[\nif (a < b) {\n  console.log("raw content");\n}\n]]></script>',
        note: 'CDATA keeps text unescaped. Only the terminator `]]>` is forbidden inside the section.',
      },
      {
        title: 'Entity Reference',
        code: '<text>Tom &amp; Jerry &lt;3</text>',
        note: 'Special characters like `&`, `<`, and `>` are represented through entity references in normal text.',
      },
    ],
  },
  {
    title: 'Namespaces And Qualified Names',
    cards: [
      {
        title: 'Default Namespace',
        code: '<invoice xmlns="urn:example:invoice">\n  <number>INV-1</number>\n</invoice>',
        note: 'Declares the namespace applied to unprefixed element names in the current scope.',
      },
      {
        title: 'Prefixed Namespace',
        code: '<doc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n     xsi:schemaLocation="urn:example invoice.xsd">\n  <title>Example</title>\n</doc>',
        note: 'A namespace prefix maps a short lexical prefix like `xsi` to a namespace URI.',
      },
      {
        title: 'Qualified Element Name',
        code: '<inv:invoice xmlns:inv="urn:example:invoice">\n  <inv:number>INV-1</inv:number>\n</inv:invoice>',
        note: 'A prefixed name combines a namespace prefix and a local name into one qualified element name.',
      },
      {
        title: 'Namespace Declaration Scope',
        code: '<root xmlns:a="urn:a">\n  <child>\n    <a:item />\n  </child>\n</root>',
        note: 'Namespace declarations apply to the element where they appear and to descendants unless overridden.',
      },
      {
        title: 'Unqualified Attribute',
        code: '<item xmlns="urn:example" code="A1" />',
        note: 'Default namespaces do not automatically apply to unprefixed attributes. Attributes are unqualified unless explicitly prefixed.',
      },
      {
        title: 'Prefixed Attribute',
        code: '<item xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n      xsi:nil="true" />',
        note: 'A prefixed attribute name belongs to the namespace bound to that prefix.',
      },
    ],
  },
  {
    title: 'Content Patterns',
    cards: [
      {
        title: 'Repeated Siblings',
        code: '<items>\n  <item>Coffee</item>\n  <item>Tea</item>\n  <item>Water</item>\n</items>',
        note: 'Multiple sibling elements with the same name are valid XML. Whether they are allowed is a schema question, not a syntax question.',
      },
      {
        title: 'Mixed Content',
        code: '<paragraph>\n  Use <emphasis>strong</emphasis> formatting.\n</paragraph>',
        note: 'Text and child elements can coexist in one element. Many document-oriented XML vocabularies rely on this pattern.',
      },
      {
        title: 'Whitespace In Content',
        code: '<note>\n  <line>One</line>\n  <line>Two</line>\n</note>',
        note: 'Indentation and line breaks are character data too. Some parsers preserve them, and schemas may normalize them depending on type.',
      },
      {
        title: 'Attribute Value Quoting',
        code: '<entry key="status" value="open" />',
        note: 'Attribute values must be quoted with either double quotes or single quotes.',
      },
      {
        title: 'Empty vs Nil-Like Meaning',
        code: '<comment />\n<comment></comment>',
        note: 'These two forms are XML-equivalent. A true nil semantic like `xsi:nil="true"` is schema-driven, not built into plain XML syntax.',
      },
      {
        title: 'Common Scalar Lexical Forms',
        code: '<flag>true</flag>\n<count>3</count>\n<date>2026-04-07</date>\n<timestamp>2026-04-07T12:00:00Z</timestamp>',
        note: 'Schemas often expect specific lexical forms for booleans, numbers, dates, and datetimes even though XML itself treats them as text.',
      },
      {
        title: 'Language Annotation',
        code: '<title xml:lang="en">Coffee report</title>',
        note: 'The reserved `xml:` prefix includes standard attributes such as `xml:lang`, `xml:space`, `xml:base`, and `xml:id`.',
      },
      {
        title: 'Escaped Attribute Content',
        code: '<link title="Tom &amp; Jerry &quot;classic&quot;" />',
        note: 'The same escaping rules apply inside attribute values, with quotes requiring special care.',
      },
    ],
  },
  {
    title: 'Well-Formedness Rules',
    cards: [
      {
        title: 'Single Root Rule',
        code: '<a />\n<b />',
        note: 'Two top-level elements in one document make the XML not well-formed. A document may have only one root element.',
      },
      {
        title: 'Proper Nesting',
        code: '<b><i>text</b></i>',
        note: 'Elements must close in reverse order of opening. Crossed tags are not well-formed XML.',
      },
      {
        title: 'Case Sensitivity',
        code: '<Item>...</item>',
        note: 'XML names are case-sensitive. `Item` and `item` are different names.',
      },
      {
        title: 'Legal Name Syntax',
        code: '<123item />',
        note: 'Names cannot start with digits or many punctuation characters. XML names have strict lexical rules.',
      },
      {
        title: 'Comment Restriction',
        code: '<!-- wrong -- comment -->',
        note: 'The sequence `--` is not allowed inside XML comments.',
      },
      {
        title: 'Reserved Prefixes',
        code: '<xml:item />',
        note: 'Prefixes like `xml` and `xmlns` are reserved and cannot be freely rebound for arbitrary vocabularies.',
      },
      {
        title: 'Unicode Text',
        code: '<city>Łódź</city>',
        note: 'XML is Unicode-based. Encoding declarations and actual byte encoding must agree.',
      },
    ],
  },
  {
    title: 'Validation And Interop',
    cards: [
      {
        title: 'Well-Formed vs Valid',
        code: '<invoice><number>INV-1</number></invoice>',
        note: 'A document can be well-formed XML without being valid against any DTD or XSD.',
      },
      {
        title: 'Schema Location Hint',
        code: '<invoice xmlns="urn:example:invoice"\n         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n         xsi:schemaLocation="urn:example:invoice invoice.xsd" />',
        note: 'Schema hints help tools find an XSD, but they do not validate anything by themselves.',
      },
      {
        title: 'Order Matters Under XSD',
        code: '<person>\n  <firstName>Alice</firstName>\n  <lastName>Nguyen</lastName>\n</person>',
        note: 'XML syntax allows this structure, but XSD may additionally require exact child order, cardinality, and namespaces.',
      },
      {
        title: 'Optional vs Required',
        code: '<user role="admin">\n  <name>Alice</name>\n  <email>alice@example.com</email>\n</user>',
        note: 'Whether an element or attribute is required is determined by the schema or other application rules, not by XML syntax alone.',
      },
      {
        title: 'Parser View Of The Tree',
        code: '<root>\n  <child id="1">value</child>\n</root>',
        note: 'Most XML tooling works on a parsed tree with nodes, attributes, text nodes, comments, and namespace context rather than raw text.',
      },
    ],
  },
];

export const XSD_HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    title: 'Schema Document',
    cards: [
      {
        title: 'Schema Root',
        code: '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">\n  ...\n</xs:schema>',
        note: 'The document root for an XSD. It holds namespace declarations, defaults, imports, global declarations, and all other schema components.',
      },
      {
        title: 'Include',
        code: '<xs:include schemaLocation="common-types.xsd" />',
        note: 'Brings in schema documents with the same target namespace. Use it to split one namespace across multiple files.',
      },
      {
        title: 'Import',
        code: '<xs:import\n  namespace="urn:example:common"\n  schemaLocation="common.xsd" />',
        note: 'Loads components from a different target namespace. This is how one schema references types or elements defined elsewhere.',
      },
      {
        title: 'Redefine',
        code: '<xs:redefine schemaLocation="base.xsd">\n  <xs:complexType name="CustomerType">\n    ...\n  </xs:complexType>\n</xs:redefine>',
        note: 'Allows limited redefinition of selected components from another schema. It exists in XSD 1.0 but is uncommon and easy to misuse.',
      },
      {
        title: 'Override',
        code: '<xs:override schemaLocation="base.xsd">\n  <xs:simpleType name="CodeType">\n    ...\n  </xs:simpleType>\n</xs:override>',
        note: 'XSD 1.1 replacement for redefining components from another schema. It explicitly overrides imported declarations.',
      },
      {
        title: 'Annotation',
        code: '<xs:annotation>\n  <xs:documentation>Human-readable note</xs:documentation>\n  <xs:appinfo>Tool-specific metadata</xs:appinfo>\n</xs:annotation>',
        note: 'Carries non-validation metadata. It is the shared wrapper for human docs and application-specific data.',
      },
      {
        title: 'Documentation',
        code: '<xs:documentation xml:lang="en">\n  Customer identifier used in external integrations.\n</xs:documentation>',
        note: 'Free-form human-readable explanation. Most schema browsers surface this directly to users.',
      },
      {
        title: 'Appinfo',
        code: '<xs:appinfo>\n  <ui:label xmlns:ui="urn:example:ui">Customer ID</ui:label>\n</xs:appinfo>',
        note: 'Machine-consumable metadata for generators, editors, or custom pipelines. It does not affect validation rules by itself.',
      },
      {
        title: 'Notation',
        code: '<xs:notation name="gif" public="image/gif" system="viewer.exe" />',
        note: 'Legacy declaration for non-XML data formats referenced from XML. Rare in modern schemas, but still part of the namespace.',
      },
    ],
  },
  {
    title: 'Global Declarations',
    cards: [
      {
        title: 'Element',
        code: '<xs:element name="invoice" type="InvoiceType" />',
        note: 'Declares an element. At the top level it defines a document-level entry point; locally it describes a child node in a content model.',
      },
      {
        title: 'Attribute',
        code: '<xs:attribute name="status" type="xs:string" use="required" />',
        note: 'Declares an attribute. Attributes are scalar metadata attached to elements rather than nested document structure.',
      },
      {
        title: 'Simple Type',
        code: '<xs:simpleType name="StatusType">\n  <xs:restriction base="xs:string">\n    <xs:enumeration value="draft" />\n    <xs:enumeration value="final" />\n  </xs:restriction>\n</xs:simpleType>',
        note: 'Defines a scalar value domain. Simple types are built with restriction, list, or union.',
      },
      {
        title: 'Complex Type',
        code: '<xs:complexType name="InvoiceType">\n  <xs:sequence>\n    <xs:element name="number" type="xs:string" />\n    <xs:element name="total" type="xs:decimal" />\n  </xs:sequence>\n</xs:complexType>',
        note: 'Defines element content that can contain child elements, attributes, or mixed content.',
      },
      {
        title: 'Group',
        code: '<xs:group name="AddressGroup">\n  <xs:sequence>\n    <xs:element name="street" type="xs:string" />\n    <xs:element name="city" type="xs:string" />\n  </xs:sequence>\n</xs:group>',
        note: 'Reusable named model group for elements. Reference it with `xs:group ref="..."` when many types share the same particle structure.',
      },
      {
        title: 'Attribute Group',
        code: '<xs:attributeGroup name="AuditAttrs">\n  <xs:attribute name="createdAt" type="xs:dateTime" />\n  <xs:attribute name="updatedAt" type="xs:dateTime" />\n</xs:attributeGroup>',
        note: 'Reusable bundle of attributes. Reference it with `xs:attributeGroup ref="..."` to keep attribute sets consistent.',
      },
    ],
  },
  {
    title: 'Content Models And Wildcards',
    cards: [
      {
        title: 'Sequence',
        code: '<xs:sequence>\n  <xs:element name="firstName" type="xs:string" />\n  <xs:element name="lastName" type="xs:string" />\n</xs:sequence>',
        note: 'Ordered content model. Children must appear in the declared order unless occurrence rules permit omission.',
      },
      {
        title: 'Choice',
        code: '<xs:choice>\n  <xs:element name="email" type="xs:string" />\n  <xs:element name="phone" type="xs:string" />\n</xs:choice>',
        note: 'Alternative content model. One branch is chosen for each occurrence of the choice group.',
      },
      {
        title: 'All',
        code: '<xs:all>\n  <xs:element name="id" type="xs:string" />\n  <xs:element name="name" type="xs:string" />\n</xs:all>',
        note: 'Unordered content model where each child appears zero or one time. Useful when order should not matter.',
      },
      {
        title: 'Occurrences',
        code: '<xs:element\n  name="item"\n  type="ItemType"\n  minOccurs="0"\n  maxOccurs="unbounded" />',
        note: 'Occurrence attributes apply to elements and groups. They express optionality, repetition, and collection-like structure.',
      },
      {
        title: 'Any',
        code: '<xs:any namespace="##other" processContents="lax" />',
        note: 'Wildcard for elements from selected namespaces. It allows extensibility points where exact child names are not fixed.',
      },
      {
        title: 'Any Attribute',
        code: '<xs:anyAttribute namespace="##other" processContents="lax" />',
        note: 'Wildcard for attributes. It allows extra attributes from chosen namespaces beyond explicitly declared ones.',
      },
    ],
  },
  {
    title: 'Type Derivation And Content Forms',
    cards: [
      {
        title: 'Restriction',
        code: '<xs:restriction base="xs:string">\n  <xs:maxLength value="10" />\n</xs:restriction>',
        note: 'Creates a narrower type than the base by applying facets or by reducing allowed content for complex types.',
      },
      {
        title: 'Extension',
        code: '<xs:complexContent>\n  <xs:extension base="BasePartyType">\n    <xs:sequence>\n      <xs:element name="taxId" type="xs:string" />\n    </xs:sequence>\n  </xs:extension>\n</xs:complexContent>',
        note: 'Derives a new type by adding content or attributes to an existing base type.',
      },
      {
        title: 'Simple Content',
        code: '<xs:simpleContent>\n  <xs:extension base="xs:string">\n    <xs:attribute name="lang" type="xs:language" />\n  </xs:extension>\n</xs:simpleContent>',
        note: 'Used when an element has text content plus attributes, but no nested child elements.',
      },
      {
        title: 'Complex Content',
        code: '<xs:complexContent>\n  <xs:extension base="BaseType">\n    <xs:sequence>\n      <xs:element name="extra" type="xs:string" />\n    </xs:sequence>\n  </xs:extension>\n</xs:complexContent>',
        note: 'Used when deriving complex types that already have structured child content.',
      },
      {
        title: 'List',
        code: '<xs:simpleType name="TagsType">\n  <xs:list itemType="xs:string" />\n</xs:simpleType>',
        note: 'Defines a whitespace-separated list of scalar items. The value is text, but each token must match the item type.',
      },
      {
        title: 'Union',
        code: '<xs:simpleType name="CodeOrNumber">\n  <xs:union memberTypes="xs:string xs:int" />\n</xs:simpleType>',
        note: 'Allows a value to match one of several member types.',
      },
      {
        title: 'Open Content',
        code: '<xs:openContent mode="interleave">\n  <xs:any namespace="##other" processContents="lax" />\n</xs:openContent>',
        note: 'XSD 1.1 mechanism for allowing extra wildcard content in complex types.',
      },
      {
        title: 'Default Open Content',
        code: '<xs:defaultOpenContent appliesToEmpty="true">\n  <xs:any namespace="##other" processContents="lax" />\n</xs:defaultOpenContent>',
        note: 'XSD 1.1 default wildcard content applied schema-wide unless a type says otherwise.',
      },
      {
        title: 'Alternative',
        code: '<xs:alternative test="@kind = \'business\'" type="BusinessCustomerType" />',
        note: 'XSD 1.1 type alternative for selecting a type based on an XPath test at validation time.',
      },
      {
        title: 'Assert',
        code: '<xs:assert test="@start le @end" />',
        note: 'XSD 1.1 assertion on complex types. It uses XPath expressions to express cross-field rules.',
      },
    ],
  },
  {
    title: 'Identity Constraints',
    cards: [
      {
        title: 'Unique',
        code: '<xs:unique name="UniqueEmail">\n  <xs:selector xpath="customer" />\n  <xs:field xpath="@email" />\n</xs:unique>',
        note: 'Requires selected values to be unique within the selected scope, but does not require them to exist.',
      },
      {
        title: 'Key',
        code: '<xs:key name="CustomerKey">\n  <xs:selector xpath="customer" />\n  <xs:field xpath="@id" />\n</xs:key>',
        note: 'Like `unique`, but values are also required to be present. It creates a key space that `keyref` can target.',
      },
      {
        title: 'Keyref',
        code: '<xs:keyref name="CustomerRef" refer="CustomerKey">\n  <xs:selector xpath="order" />\n  <xs:field xpath="@customerId" />\n</xs:keyref>',
        note: 'Declares referential integrity. Selected values must match an existing `xs:key` or `xs:unique` set.',
      },
      {
        title: 'Selector',
        code: '<xs:selector xpath="lineItem" />',
        note: 'XPath that chooses the set of nodes participating in an identity constraint.',
      },
      {
        title: 'Field',
        code: '<xs:field xpath="@sku" />',
        note: 'XPath that extracts the actual key value from each node selected by `xs:selector`.',
      },
    ],
  },
  {
    title: 'Facets For Simple Types',
    cards: [
      {
        title: 'Enumeration',
        code: '<xs:enumeration value="draft" />',
        note: 'Limits a value to one item from a fixed list.',
      },
      {
        title: 'Pattern',
        code: '<xs:pattern value="[A-Z]{3}-[0-9]{2}" />',
        note: 'Constrains lexical form with an XML Schema regular expression.',
      },
      {
        title: 'Length',
        code: '<xs:length value="8" />',
        note: 'Requires an exact string or list length.',
      },
      {
        title: 'Min Length',
        code: '<xs:minLength value="3" />',
        note: 'Requires at least the given string or list length.',
      },
      {
        title: 'Max Length',
        code: '<xs:maxLength value="32" />',
        note: 'Caps string or list length.',
      },
      {
        title: 'Min Inclusive',
        code: '<xs:minInclusive value="0" />',
        note: 'Lower numeric or date boundary, inclusive of the stated value.',
      },
      {
        title: 'Max Inclusive',
        code: '<xs:maxInclusive value="100" />',
        note: 'Upper numeric or date boundary, inclusive of the stated value.',
      },
      {
        title: 'Min Exclusive',
        code: '<xs:minExclusive value="0" />',
        note: 'Lower boundary that excludes the stated value itself.',
      },
      {
        title: 'Max Exclusive',
        code: '<xs:maxExclusive value="100" />',
        note: 'Upper boundary that excludes the stated value itself.',
      },
      {
        title: 'Total Digits',
        code: '<xs:totalDigits value="12" />',
        note: 'Maximum number of digits allowed in a decimal value.',
      },
      {
        title: 'Fraction Digits',
        code: '<xs:fractionDigits value="2" />',
        note: 'Maximum number of digits allowed after the decimal point.',
      },
      {
        title: 'Whitespace',
        code: '<xs:whiteSpace value="collapse" />',
        note: 'Controls whitespace normalization before validation. Typical values are `preserve`, `replace`, and `collapse`.',
      },
      {
        title: 'Assertion',
        code: '<xs:assertion test="string-length(.) ge 5" />',
        note: 'XSD 1.1 simple-type facet using XPath-based assertions.',
      },
      {
        title: 'Explicit Timezone',
        code: '<xs:explicitTimezone value="required" />',
        note: 'XSD 1.1 facet controlling whether date/time values must include a timezone, must omit it, or may use either form.',
      },
    ],
  },
];
