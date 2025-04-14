import { NgModule } from '@angular/core';
import { TisImageAndFileUploadAndViewComponent } from './tis-image-and-file-upload-and-view/tis-image-and-file-upload-and-view.component';
import { TisPreviewImageComponent } from './tis-preview-image/tis-preview-image.component';
import { CommonModule } from '@angular/common';
import { TisFileViewerComponent } from './tis-file-viewer/tis-file-viewer.component';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TisErrorDialogComponent } from './tis-error-dialog/tis-error-dialog.component';
import { TisConfirmationDialogComponent } from './tis-confirmation-dialog/tis-confirmation-dialog.component';
import { TisExcelFileViewerComponent } from './tis-file-viewer/tis-excel-file-viewer/tis-excel-file-viewer.component';
import { TisPdfViewerComponent } from './tis-file-viewer/tis-pdf-viewer/tis-pdf-viewer.component';
import { TisVideoComponent } from './tis-file-viewer/tis-video/tis-video.component';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';


const uiImports = [
  MatTooltipModule,
  MatIconModule,
  MatSnackBarModule,
  MatProgressSpinnerModule,
  MatButtonModule,
  MatDialogModule,
];


@NgModule({
  declarations: [
    TisImageAndFileUploadAndViewComponent,
    TisPreviewImageComponent,
    TisFileViewerComponent,
    TisExcelFileViewerComponent,
    TisPdfViewerComponent,
    TisVideoComponent,
    TisErrorDialogComponent,
    TisConfirmationDialogComponent
  ],
  imports: [
    CommonModule,
    NgxExtendedPdfViewerModule,
    ...uiImports
  ],
  exports: [
    TisImageAndFileUploadAndViewComponent
  ]
})
export class TisImageAndFileUploadAndViewModule { }
