import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-success',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  template: `
    <div class="success-page">
      <div class="success-content animate-slide-up">
        <div class="success-icon">
          <mat-icon>check_circle</mat-icon>
        </div>
        <h1>Upload Complete!</h1>
        <p>Your files have been sent to the desktop successfully.</p>
        <button mat-raised-button color="primary" routerLink="/">
          <mat-icon>add_photo_alternate</mat-icon>
          Upload More Files
        </button>
      </div>
    </div>
  `,
  styles: [`
    .success-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .success-content {
      text-align: center;
      color: white;
    }

    .success-icon {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(76, 175, 80, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;

      mat-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: #69f0ae;
      }
    }

    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      font-weight: 700;
    }

    p {
      margin: 0 0 32px;
      opacity: 0.9;
      font-size: 16px;
    }

    button {
      height: 56px;
      padding: 0 32px;
      border-radius: 28px;
      font-size: 16px;

      mat-icon {
        margin-right: 8px;
      }
    }
  `]
})
export class SuccessComponent {}
