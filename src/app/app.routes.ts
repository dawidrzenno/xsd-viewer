import type { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: 'files',
    pathMatch: 'full',
  },
  {
    path: 'files',
    loadComponent: () =>
      import('./features/schema-tree/schema-tree-page.component').then((module) => module.SchemaTreePageComponent),
  },
  {
    path: 'composer',
    loadComponent: () =>
      import('./features/xml-composer/xml-composer-page.component').then((module) => module.XmlComposerPageComponent),
  },
  {
    path: 'handbooks',
    pathMatch: 'full',
    redirectTo: 'handbooks/xsd',
  },
  {
    path: 'handbooks/xsd',
    loadComponent: () =>
      import('./features/handbooks/xsd-handbook.component').then((module) => module.XsdHandbookComponent),
  },
  {
    path: 'handbooks/xml',
    loadComponent: () =>
      import('./features/handbooks/xml-handbook.component').then((module) => module.XmlHandbookComponent),
  },
  {
    path: '**',
    redirectTo: 'files',
  },
];
