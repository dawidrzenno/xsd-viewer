import { Component, inject } from '@angular/core';
import { SchemaTreeComponent } from './schema-tree.component';
import { WorkspaceStore } from '../../workspace.store';

@Component({
  selector: 'app-schema-tree-page',
  standalone: true,
  imports: [SchemaTreeComponent],
  template: `
    <app-schema-tree
      [fileGroups]="workspace.fileGroups()"
      (fileRemove)="workspace.onRemoveFile($event)"
    />
  `,
})
export class SchemaTreePageComponent {
  protected readonly workspace = inject(WorkspaceStore);
}
