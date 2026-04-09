import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { convertXmlToJson } from '../../../xml-to-json';
import { PrismHighlightPipe } from '../../shared/pipes/prism-highlight.pipe';

@Component({
  selector: 'app-example-json-panel',
  standalone: true,
  imports: [CommonModule, PrismHighlightPipe],
  templateUrl: './example-json-panel.component.html',
  styleUrl: './example-json-panel.component.scss',
})
export class ExampleJsonPanelComponent {
  @Input({ required: true }) exampleXml = '';
  @Input() title = 'Example JSON Converter';
  @Input() subtitle = 'Convert the generated XML example into a JSON representation.';
  @Input() embedded = false;

  protected get previewJson(): string {
    if (!this.exampleXml) {
      return '';
    }

    try {
      return convertXmlToJson(this.exampleXml);
    } catch (error) {
      return `Could not convert XML to JSON: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
    }
  }

  protected async copyJson(): Promise<void> {
    if (!this.previewJson) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.previewJson);
    } catch (error) {
      console.error('Could not copy JSON:', error);
    }
  }
}
