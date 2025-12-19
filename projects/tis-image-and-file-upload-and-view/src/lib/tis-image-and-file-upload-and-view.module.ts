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
import { MatDividerModule } from '@angular/material/divider';
import { TisErrorDialogComponent } from './tis-error-dialog/tis-error-dialog.component';
import { TisConfirmationDialogComponent } from './tis-confirmation-dialog/tis-confirmation-dialog.component';
import { TisExcelFileViewerComponent } from './tis-file-viewer/tis-excel-file-viewer/tis-excel-file-viewer.component';
import { TisPdfViewerComponent } from './tis-file-viewer/tis-pdf-viewer/tis-pdf-viewer.component';
import { TisVideoComponent } from './tis-file-viewer/tis-video/tis-video.component';
import { TisQrCodeDialogComponent } from './tis-qr-code-dialog/tis-qr-code-dialog.component';
import { TisViewConnectionDialogComponent } from './tis-view-connection-dialog/tis-view-connection-dialog.component';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClientModule } from '@angular/common/http';
import { QRCodeComponent } from 'angularx-qrcode';


const uiImports = [
  MatTooltipModule,
  MatIconModule,
  MatSnackBarModule,
  MatProgressSpinnerModule,
  MatInputModule,
  MatButtonModule,
  MatDialogModule,
  MatDividerModule,
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
    TisConfirmationDialogComponent,
    TisQrCodeDialogComponent,
    TisViewConnectionDialogComponent
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    NgxExtendedPdfViewerModule,
    FormsModule,
    ReactiveFormsModule,
    QRCodeComponent,
    ...uiImports,
    DragDropModule
  ],
  exports: [
    TisImageAndFileUploadAndViewComponent,
    TisQrCodeDialogComponent
  ]
})
export class TisImageAndFileUploadAndViewModule { }
