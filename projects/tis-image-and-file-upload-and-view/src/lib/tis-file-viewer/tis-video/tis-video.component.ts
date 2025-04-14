import { Component, Input, SimpleChanges } from '@angular/core';
import type { SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'tis-video',
  standalone: false,
  templateUrl: './tis-video.component.html',
  styleUrl: './tis-video.component.css'
})
export class TisVideoComponent {
  @Input({ required: true }) src!: SafeUrl;
  type!: string;

  constructor() {}

  ngOnInit(): void {
    if(this.src){
      this.type = this.getFileType(String(this.src));
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes['src']) {
      console.log('Pdf Viewer: src changed: ', changes['src']);
      this.type = this.getFileType(changes['src'].currentValue);
    }
  }

  getFileType(text: string) {
    let txtArr = text.split('.');
    let fileType = txtArr[txtArr.length - 1];
    return fileType.toLocaleLowerCase() == 'mov' ? 'mp4': fileType.toLocaleLowerCase();
  }
}
