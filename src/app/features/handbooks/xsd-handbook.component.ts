import { Component } from '@angular/core';
import { XSD_HANDBOOK_SECTIONS } from './handbook-data';
import { HandbookPanelComponent } from './handbook-panel.component';

@Component({
  selector: 'app-xsd-handbook',
  standalone: true,
  imports: [HandbookPanelComponent],
  template: `
    <app-handbook-panel
      handbookId="xsd"
      [title]="'XSD Handbook'"
      [subtitle]="'Reference for elements in the XML Schema namespace, grouped by what each construct does.'"
      [sections]="sections"
    />
  `,
})
export class XsdHandbookComponent {
  protected readonly sections = XSD_HANDBOOK_SECTIONS;
}
