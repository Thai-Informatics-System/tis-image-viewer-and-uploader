import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './error.component.html',
  styleUrl: './error.component.scss'
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
