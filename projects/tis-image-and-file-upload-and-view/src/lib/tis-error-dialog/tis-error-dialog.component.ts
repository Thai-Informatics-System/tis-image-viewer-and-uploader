import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'lib-tis-error-dialog',
  standalone: false,
  templateUrl: './tis-error-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tis-error-dialog.component.css'
})
export class TisErrorDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<TisErrorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
}
