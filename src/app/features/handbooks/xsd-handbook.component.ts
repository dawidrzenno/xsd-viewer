import { Component } from '@angular/core';
import { XSD_HANDBOOK_SECTIONS } from './handbook-data';
import { HandbookPanelComponent } from './handbook-panel.component';

@Component({
  selector: 'app-xsd-handbook',
  standalone: true,
  imports: [HandbookPanelComponent],
  template: `
    <app-handbook-panel
      title="XSD Handbook"
      subtitle="Practical reference for defining schemas, constraints, and reusable types."
      [sections]="sections"
    />
  `,
})
export class XsdHandbookComponent {
  protected readonly sections = XSD_HANDBOOK_SECTIONS;
}
