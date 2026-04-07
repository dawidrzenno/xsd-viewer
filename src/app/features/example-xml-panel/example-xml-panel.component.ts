import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PrismHighlightPipe } from '../../shared/pipes/prism-highlight.pipe';

interface RootOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-example-xml-panel',
  standalone: true,
  imports: [CommonModule, PrismHighlightPipe],
  templateUrl: './example-xml-panel.component.html',
  styleUrl: './example-xml-panel.component.scss',
})
export class ExampleXmlPanelComponent {
  @Input({ required: true }) rootOptions: RootOption[] = [];
  @Input({ required: true }) selectedRoot = '';
  @Input({ required: true }) exampleXml = '';

  @Output() readonly selectedRootChange = new EventEmitter<string>();

  protected readonly emptyState = 'Load one or more XSD files to generate example XML.';

  protected onRootChange(rootName: string): void {
    this.selectedRootChange.emit(rootName);
  }

  protected async copyXml(): Promise<void> {
    if (!this.exampleXml) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.exampleXml);
    } catch (error) {
      console.error('Could not copy XML:', error);
    }
  }
}
