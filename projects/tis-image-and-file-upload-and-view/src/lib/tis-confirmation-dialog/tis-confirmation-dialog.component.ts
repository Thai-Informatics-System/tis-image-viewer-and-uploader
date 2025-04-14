import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'tis-confirmation-dialog',
  standalone: false,
  templateUrl: './tis-confirmation-dialog.component.html',
  styleUrl: './tis-confirmation-dialog.component.css'
})
export class TisConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<TisConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.dialogRef.addPanelClass(['md-tis-w-400-px']);
  }

  onClose(status: boolean | null): void {
    this.dialogRef.close(status);
  }
}
