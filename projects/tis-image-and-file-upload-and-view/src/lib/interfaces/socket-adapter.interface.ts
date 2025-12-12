import { Observable } from 'rxjs';

/**
 * Interface that the host application must implement to enable
 * remote upload functionality via WebSocket.
 * 
 * This allows the library to leverage an existing WebSocket connection
 * from the host application instead of creating its own.
 */
export interface TisSocketAdapter {
  /**
   * Subscribe to a channel and return an Observable of messages
   * @param channelName - The channel name to subscribe to
   * @returns Observable that emits messages received on the channel
   */
  subscribeToChannel(channelName: string): Observable<any>;

  /**
   * Subscribe to channels matching a prefix (optional)
   * @param prefix - The prefix to match channel names
   * @returns Observable that emits messages from matching channels
   */
  subscribeToChannelPrefix?(prefix: string): Observable<any>;

  /**
   * Unsubscribe from a channel
   * @param channelName - The channel name to unsubscribe from
   */
  unsubscribeFromChannel?(channelName: string): void;

  /**
   * Get unique device/browser ID for pairing
   * @returns Device ID string or Promise that resolves to device ID
   */
  getDeviceId(): string | Promise<string>;

  /**
   * Check if socket is currently connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean;

  /**
   * Observable that emits connection status changes
   */
  connectionStatus$: Observable<boolean>;

  /**
   * Get current auth token (for passing to mobile app)
   * @returns Current access token or null
   */
  getAuthToken?(): string | null | Promise<string | null>;

  /**
   * Get current refresh token (for passing to mobile app)
   * @returns Current refresh token or null
   */
  getRefreshToken?(): string | null | Promise<string | null>;

  /**
   * Get the WebSocket URL (for passing to mobile app)
   * @returns WebSocket URL string
   */
  getSocketUrl?(): string;

  /**
   * Get the API base URL (for passing to mobile app)
   * @returns API base URL string
   */
  getApiUrl?(): string;

  /**
   * Get the current user ID
   * @returns User ID string
   */
  getUserId?(): string | Promise<string>;

  /**
   * Send a message directly via socket (for handshake and communication)
   * @param message - The message to send { action: string; data: any }
   */
  sendViaSocket?(message: { action: string; data: any }): void;

  /**
   * Call API via socket and get response as Observable
   * @param route - The API route to call
   * @param body - The request body
   * @returns Observable that emits the API response
   */
  callApiViaSocket?(route: string, body: any): Observable<any>;
}

/**
 * Configuration for remote upload feature
 */
export interface TisRemoteUploadConfig {
  /**
   * Enable/disable remote upload feature
   */
  enabled: boolean;

  /**
   * Socket adapter implementation from host app
   */
  socketAdapter?: TisSocketAdapter;

  /**
   * API endpoints for remote upload operations
   */
  apiEndpoints?: TisRemoteUploadApiEndpoints;

  /**
   * QR code configuration
   */
  qrCode?: TisQrCodeConfig;

  /**
   * Pairing configuration
   */
  pairing?: TisPairingConfig;
}

/**
 * API endpoints configuration for remote upload
 */
export interface TisRemoteUploadApiEndpoints {
  /**
   * Endpoint to generate a mobile upload link token (UUID)
   * POST request with deviceId, userId, returns { token, expiresAt }
   * Default: {apiUrl}/ease-of-access/mobile-upload-link-token
   */
  generateMobileLinkToken?: string;

  /**
   * Endpoint to generate a pairing code (legacy)
   * POST request with deviceId, returns { pairingCode, channel, expiresAt }
   */
  generatePairingCode?: string;

  /**
   * Endpoint to validate a pairing code (used by mobile)
   * POST request with pairingCode, returns { valid, deviceId, channel }
   */
  validatePairingCode?: string;

  /**
   * Endpoint called by mobile after uploading to notify desktop
   * POST request with { channel, uploadedFile }
   */
  notifyUpload?: string;

  /**
   * Channel prefix for receiving upload notifications
   * Desktop subscribes to: {prefix}{deviceId}
   */
  uploadChannelPrefix: string;
}

/**
 * QR code display configuration
 */
export interface TisQrCodeConfig {
  /**
   * Base URL for the mobile upload page
   * The full URL will be: {mobileUploadUrl}?code={pairingCode}&deviceId={deviceId}
   */
  mobileUploadUrl: string;

  /**
   * QR code expiry time in seconds (default: 300 = 5 minutes)
   */
  expirySeconds?: number;

  /**
   * Size of the QR code in pixels (default: 200)
   */
  size?: number;

  /**
   * Logo URL to display in the center of QR code (optional)
   */
  logoUrl?: string;
}

/**
 * Pairing persistence configuration
 */
export interface TisPairingConfig {
  /**
   * Whether to persist pairing in localStorage (default: true)
   */
  persistInStorage?: boolean;

  /**
   * Storage key for pairing data (default: 'tis-remote-upload-pairing')
   */
  storageKey?: string;

  /**
   * How long pairing remains valid in milliseconds (default: 24 hours)
   * Set to 0 for session-only pairing
   */
  pairingTTL?: number;

  /**
   * Whether to auto-reconnect on page reload if pairing exists
   */
  autoReconnect?: boolean;
}

/**
 * Pairing session data stored in localStorage
 */
export interface TisPairingSession {
  /**
   * Unique pairing code
   */
  pairingCode: string;

  /**
   * Desktop device ID
   */
  desktopDeviceId: string;

  /**
   * Mobile device ID (set after mobile connects)
   */
  mobileDeviceId?: string;

  /**
   * WebSocket channel for communication
   */
  channel: string;

  /**
   * When the pairing was created
   */
  createdAt: number;

  /**
   * When the pairing expires
   */
  expiresAt: number;

  /**
   * Current pairing status
   */
  status: 'pending' | 'connected' | 'disconnected' | 'expired';

  /**
   * Last activity timestamp
   */
  lastActivity?: number;
}

/**
 * Event emitted when a remote upload is received
 */
export interface TisRemoteUploadEvent {
  /**
   * The uploaded file data
   */
  file: TisRemoteUploadedFile;

  /**
   * Mobile device ID that uploaded the file
   */
  mobileDeviceId: string;

  /**
   * Timestamp of the upload
   */
  timestamp: number;

  /**
   * Session ID for grouping multiple uploads
   */
  sessionId?: string;
}

/**
 * File data received from remote upload
 */
export interface TisRemoteUploadedFile {
  /**
   * S3 or cloud storage URL of the uploaded file
   */
  s3Url: string;

  /**
   * Original filename
   */
  fileName: string;

  /**
   * File MIME type
   */
  mimeType: string;

  /**
   * File size in bytes
   */
  size: number;

  /**
   * Thumbnail URL (for images)
   */
  thumbnailUrl?: string;

  /**
   * Additional metadata from the upload
   */
  metadata?: Record<string, any>;

  /**
   * Upload data from presigned URL response
   */
  uploadData?: any;
}

/**
 * Message format for WebSocket communication
 */
export interface TisRemoteUploadMessage {
  /**
   * Message type
   */
  type: 'pairing_request' | 'pairing_accepted' | 'upload_started' | 'upload_progress' | 'upload_complete' | 'upload_error' | 'disconnect';

  /**
   * Channel name
   */
  channel: string;

  /**
   * Message payload
   */
  payload: any;

  /**
   * Sender device ID
   */
  senderId: string;

  /**
   * Timestamp
   */
  timestamp: number;
}
