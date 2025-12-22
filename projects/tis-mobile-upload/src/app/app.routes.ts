import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/upload/upload.component').then(m => m.UploadComponent)
  },
  {
    path: 'error',
    loadComponent: () => import('./pages/error/error.component').then(m => m.ErrorComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
