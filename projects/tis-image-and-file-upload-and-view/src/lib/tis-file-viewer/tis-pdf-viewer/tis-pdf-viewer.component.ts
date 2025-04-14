import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import type { SafeUrl } from '@angular/platform-browser';
import { NgxExtendedPdfViewerComponent } from 'ngx-extended-pdf-viewer';

@Component({
  selector: 'tis-pdf-viewer',
  standalone: false,
  templateUrl: './tis-pdf-viewer.component.html',
  styleUrl: './tis-pdf-viewer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TisPdfViewerComponent implements OnChanges {

  loading = true;
  isError = false;

  @Input({ required: true }) src!: string;

  @ViewChild(NgxExtendedPdfViewerComponent, { static: false })
  private pdfViewer!: NgxExtendedPdfViewerComponent;

  constructor(
    private cdRef: ChangeDetectorRef
  ) {

  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes['src']) {
      console.log('Pdf Viewer: src changed: ', changes['src']);
    }
  }

  destroyPdfViewer() {
    this.pdfViewer.ngOnDestroy();
  }

  loadingFinished(ev: any) {
    console.log('PDF Loaded', ev)
    this.loading = false;
    this.cdRef.detectChanges();
    this.pdfViewer.height = 'auto';
  }

  loadingError(ev: any) {
    console.log('PDF Loading Error:', ev);
    this.isError = true;
    this.loading = false;
    this.cdRef.detectChanges();
  }

}
