import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import type { SafeUrl } from '@angular/platform-browser';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'tis-excel-file-viewer',
  standalone: false,
  templateUrl: './tis-excel-file-viewer.component.html',
  styleUrl: './tis-excel-file-viewer.component.css'
})
export class TisExcelFileViewerComponent implements OnChanges {

  @Input({ required: true }) src!: SafeUrl;

  baseUrl =  `https://view.officeapps.live.com/op/embed.aspx?src=`;
  iframeSrc: SafeUrl | null = null;

  constructor(private sanitizer: DomSanitizer ) {

  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['src']) {
      console.log('Url Received', this.src);
      const src = this.baseUrl + this.src;
      this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(src);
      console.log('Iframe src:', this.iframeSrc);
    }
  }

  
}
