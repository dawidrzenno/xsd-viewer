import { Component } from '@angular/core';
import { XML_HANDBOOK_SECTIONS } from './handbook-data';
import { HandbookPanelComponent } from './handbook-panel.component';

@Component({
  selector: 'app-xml-handbook',
  standalone: true,
  imports: [HandbookPanelComponent],
  template: `
    <app-handbook-panel
      title="XML Handbook"
      subtitle="Practical reference for reading, editing, and validating XML documents."
      [sections]="sections"
    />
  `,
})
export class XmlHandbookComponent {
  protected readonly sections = XML_HANDBOOK_SECTIONS;
}
