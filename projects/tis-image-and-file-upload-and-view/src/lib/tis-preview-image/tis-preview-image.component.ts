import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'tis-preview-image',
  standalone: false,
  templateUrl: './tis-preview-image.component.html',
  styleUrl: './tis-preview-image.component.css'
})
export class TisPreviewImageComponent {
  width = 850;
  height = 650;
  isLoading: boolean = true;
  isLandscape: boolean | undefined;
  orientation: string | undefined;
  imageWidth: number | undefined;
  imageHeight: number | undefined;


  constructor(
    public dialogRef: MatDialogRef<TisPreviewImageComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) { }

  ngOnInit(): void {
    if (this.data.url) {
      setTimeout(() => {
        this.checkImageOrientation(this.data.url);
      }, 500);
    }
  }

  checkImageOrientation(imageUrl: string): void {
    const img = new Image();
    img.src = imageUrl;
    this.isLoading = true;

    img.onload = () => {
      this.imageWidth = img.naturalWidth;
      this.imageHeight = img.naturalHeight;
      this.isLandscape = img.naturalWidth > img.naturalHeight;
      this.orientation = this.isLandscape ? 'landscape-image' : 'portrait-image';
      this.isLoading = false;
    };

    img.onerror = () => {
      console.error('Failed to load image.');
      this.isLoading = false;
    };
  }

  onClose() {
    this.dialogRef.close()
  }
}
