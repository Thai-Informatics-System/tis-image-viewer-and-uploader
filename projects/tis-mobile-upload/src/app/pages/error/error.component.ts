import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  template: `
    <div class="error-page">
      <div class="error-content animate-slide-up">
        <div class="error-icon">
          <mat-icon>{{ errorIcon }}</mat-icon>
        </div>
        <h1>{{ errorTitle }}</h1>
        <p>{{ errorMessage }}</p>
        <div class="error-actions">
          @if (showRetry) {
            <button mat-raised-button color="primary" routerLink="/">
              <mat-icon>refresh</mat-icon>
              Try Again
            </button>
          }
          @if (showScanAgain) {
            <button mat-raised-button color="accent">
              <mat-icon>qr_code_scanner</mat-icon>
              Scan QR Code Again
            </button>
          }
        </div>
        <p class="help-text" *ngIf="showHelp">
          Having trouble? Make sure you're scanning the QR code from the desktop application.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .error-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .error-content {
      text-align: center;
      color: white;
      max-width: 400px;
    }

    .error-icon {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(244, 67, 54, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;

      mat-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: #ff5252;
      }
    }

    h1 {
      margin: 0 0 12px;
      font-size: 24px;
      font-weight: 700;
    }

    p {
      margin: 0 0 24px;
      opacity: 0.9;
      font-size: 16px;
      line-height: 1.5;
    }

    .error-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;

      button {
        width: 100%;
        height: 56px;
        border-radius: 28px;
        font-size: 16px;

        mat-icon {
          margin-right: 8px;
        }
      }
    }

    .help-text {
      margin-top: 32px;
      font-size: 14px;
      opacity: 0.7;
    }
  `]
})
export class ErrorComponent {
  errorIcon = 'error';
  errorTitle = 'Something Went Wrong';
  errorMessage = 'An unexpected error occurred. Please try again.';
  showRetry = true;
  showScanAgain = false;
  showHelp = false;

  constructor(private route: ActivatedRoute) {
    this.route.queryParams.subscribe(params => {
      const errorType = params['type'];
      
      switch (errorType) {
        case 'invalid-session':
          this.errorIcon = 'link_off';
          this.errorTitle = 'Invalid Session';
          this.errorMessage = 'This upload link is invalid or has expired. Please scan a new QR code from the desktop.';
          this.showRetry = false;
          this.showScanAgain = true;
          this.showHelp = true;
          break;

        case 'session-expired':
          this.errorIcon = 'timer_off';
          this.errorTitle = 'Session Expired';
          this.errorMessage = 'Your upload session has expired. Please scan a new QR code to continue.';
          this.showRetry = false;
          this.showScanAgain = true;
          this.showHelp = true;
          break;

        case 'upload-failed':
          this.errorIcon = 'cloud_off';
          this.errorTitle = 'Upload Failed';
          this.errorMessage = 'Failed to upload your files. Please check your connection and try again.';
          this.showRetry = true;
          this.showScanAgain = false;
          this.showHelp = false;
          break;

        case 'connection-lost':
          this.errorIcon = 'wifi_off';
          this.errorTitle = 'Connection Lost';
          this.errorMessage = 'The connection to the server was lost. Please check your internet connection.';
          this.showRetry = true;
          this.showScanAgain = false;
          this.showHelp = false;
          break;

        case 'not-supported':
          this.errorIcon = 'do_not_disturb';
          this.errorTitle = 'Not Supported';
          this.errorMessage = 'Your browser does not support the required features. Please use a modern browser.';
          this.showRetry = false;
          this.showScanAgain = false;
          this.showHelp = false;
          break;

        default:
          // Use default values
          break;
      }
    });
  }
}
