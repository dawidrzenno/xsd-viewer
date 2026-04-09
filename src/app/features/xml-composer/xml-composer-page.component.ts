import { Component, inject } from '@angular/core';
import { XmlComposerPanelComponent } from './xml-composer-panel.component';
import { WorkspaceStore } from '../../workspace.store';

@Component({
  selector: 'app-xml-composer-page',
  standalone: true,
  imports: [XmlComposerPanelComponent],
  template: `
    <app-xml-composer-panel
      [schemaModel]="workspace.schemaModel()"
      [rootFileOptions]="workspace.rootFileOptions()"
    />
  `,
})
export class XmlComposerPageComponent {
  protected readonly workspace = inject(WorkspaceStore);
}
