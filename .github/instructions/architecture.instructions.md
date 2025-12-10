# Project Architecture

## Overview

This repository contains an Angular library for image and file upload functionality, along with a companion mobile Progressive Web App (PWA) for remote uploads via QR code pairing.

## Workspace Structure

```
tis-image-viewer-and-uploader/
├── .github/
│   └── instructions/           # AI assistant instruction files
├── dist/                       # Built artifacts
├── docs/                       # Documentation and reference implementations
├── projects/
│   ├── tis-image-and-file-upload-and-view/   # Main library
│   └── tis-mobile-upload/                     # Mobile PWA companion app
├── src/                        # Demo/test application for library development
├── angular.json                # Angular workspace configuration
├── package.json                # Root package.json
└── tsconfig.json               # Root TypeScript configuration
```

## Projects

### 1. Main Library: `tis-image-and-file-upload-and-view`

**Location:** `projects/tis-image-and-file-upload-and-view/`

**Package Name:** `@servicemind.tis/tis-image-and-file-upload-and-view`

**Purpose:** Angular library providing reusable components for image and file upload with preview capabilities.

#### Key Components

| Component | Selector | Description |
|-----------|----------|-------------|
| `TisImageAndFileUploadAndViewComponent` | `tis-image-and-file-upload-and-view` | Main upload component with drag-drop, preview, and remote upload |
| `TisFileViewerComponent` | `tis-file-viewer` | File preview dialog (PDF, Excel, images, video) |
| `TisPreviewImageComponent` | `tis-preview-image` | Image preview with zoom/pan |
| `TisQrCodeDialogComponent` | `tis-qr-code-dialog` | QR code dialog for mobile pairing |
| `TisConfirmationDialogComponent` | `tis-confirmation-dialog` | Confirmation dialog |
| `TisErrorDialogComponent` | `tis-error-dialog` | Error display dialog |

#### Key Services

| Service | Description |
|---------|-------------|
| `TisRemoteUploadService` | Manages desktop-mobile pairing via WebSocket |
| `TisHelperService` | Utility functions (snackbar, file helpers) |

#### Key Interfaces

Located in `src/lib/interfaces/`:

- **`UrlConfig`** - API endpoint configuration for uploads
- **`TisRemoteUploadConfig`** - Remote upload feature configuration
- **`TisSocketAdapter`** - Interface for host app's socket service integration
- **`OptionConfig`** - Component options (multiple, limit, compression, etc.)

### 2. Mobile Upload PWA: `tis-mobile-upload`

**Location:** `projects/tis-mobile-upload/`

**Purpose:** Standalone Angular PWA that users scan QR code from desktop to upload files via mobile device.

#### Key Components

| Component | Route | Description |
|-----------|-------|-------------|
| `UploadComponent` | `/upload` | Main upload page with connection status and file upload |
| `ErrorComponent` | `/error` | Error display page |
| `SuccessComponent` | `/success` | Success confirmation page |

#### Key Services

| Service | Description |
|---------|-------------|
| `MobileSocketService` | WebSocket connection to backend, handles pairing flow |
| `MobileUploadService` | Tracks uploads and sends to desktop via socket |
| `FingerprintService` | Generates unique mobile device ID |

### 3. Demo Application

**Location:** `src/`

**Purpose:** Test harness for developing and debugging the library.

**Usage:** Run `npm start` or `ng serve` to test library components.

## Remote Upload Feature Architecture

### Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DESKTOP BROWSER                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Host Application                                                    │    │
│  │  ┌─────────────────────┐    ┌────────────────────────────────────┐  │    │
│  │  │ TisSocketAdapter    │◄──►│ Host's SocketService (NgRx, etc.) │  │    │
│  │  │ (implements         │    └────────────────────────────────────┘  │    │
│  │  │  interface)         │                                            │    │
│  │  └─────────┬───────────┘                                            │    │
│  │            │                                                         │    │
│  │            ▼                                                         │    │
│  │  ┌─────────────────────┐                                            │    │
│  │  │ tis-image-and-file- │    Click "Upload from Mobile"              │    │
│  │  │ upload-and-view     │────────────────────────────┐               │    │
│  │  │ component           │                            │               │    │
│  │  └─────────────────────┘                            ▼               │    │
│  │                                          ┌─────────────────────┐    │    │
│  │                                          │ TisQrCodeDialog     │    │    │
│  │                                          │ - Shows QR code     │    │    │
│  │                                          │ - Device IDs        │    │    │
│  │                                          │ - Connection status │    │    │
│  │                                          └─────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    QR Contains: apiUrl, deviceId, userId, token
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS BACKEND                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  API Gateway + Lambda                                                │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │ POST /ease-of-access/mobile-upload-link-token               │    │    │
│  │  │ - Desktop calls to get UUID token                           │    │    │
│  │  │ - Stores: { token, deviceId, userId, expiresAt }           │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │ POST /ease-of-access/generate-login-and-refresh-token-...   │    │    │
│  │  │ - Mobile calls with token to get credentials                │    │    │
│  │  │ - Returns: { accessToken, refreshToken, socketUrl }        │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │ WebSocket API                                                │    │    │
│  │  │ - Channel: tis-mobile-upload-w-dev-{desktopDeviceId}       │    │    │
│  │  │ - Broadcasts messages between desktop ↔ mobile              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MOBILE BROWSER (PWA)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  tis-mobile-upload App                                               │    │
│  │  ┌─────────────────────┐    ┌────────────────────────────────────┐  │    │
│  │  │ MobileSocketService │◄──►│ WebSocket Connection               │  │    │
│  │  │ - Parses QR params  │    │ - Subscribes to channel            │  │    │
│  │  │ - Gets credentials  │    │ - Sends upload notifications       │  │    │
│  │  │ - Handshake         │    └────────────────────────────────────┘  │    │
│  │  └─────────┬───────────┘                                            │    │
│  │            │                                                         │    │
│  │            ▼                                                         │    │
│  │  ┌─────────────────────┐    ┌────────────────────────────────────┐  │    │
│  │  │ UploadComponent     │───►│ File Upload to S3                  │  │    │
│  │  │ - File picker       │    │ - Get presigned URL                │  │    │
│  │  │ - Progress display  │    │ - PUT to S3                        │  │    │
│  │  │ - Upload list       │    │ - Notify desktop via socket        │  │    │
│  │  └─────────────────────┘    └────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pairing Flow (Token-Based)

1. **Desktop generates token:**
   - Calls `POST /ease-of-access/mobile-upload-link-token` with `{ deviceId, userId }`
   - Backend generates UUID token, stores with expiry
   - Returns `{ token, expiresAt }`

2. **QR Code displayed:**
   - Contains: `{mobileUploadUrl}?token={token}&deviceId={desktopDeviceId}&userId={userId}&apiUrl={apiUrl}`

3. **Mobile scans QR:**
   - Parses URL params
   - Calls `POST /ease-of-access/generate-login-and-refresh-token-for-mobile-link-app`
   - Gets `{ accessToken, refreshToken, socketUrl }`

4. **Mobile connects WebSocket:**
   - Connects to `socketUrl` with credentials
   - Subscribes to channel: `tis-mobile-upload-w-dev-{desktopDeviceId}`
   - Sends `{ type: 'connectionState', connectionState: 'INITIATED', mobileDeviceId }`

5. **Desktop acknowledges:**
   - Receives INITIATED message
   - Responds with `{ type: 'connectionState', connectionState: 'SUCCESS', desktopDeviceId }`

6. **Upload flow:**
   - Mobile uploads file to S3 via presigned URL
   - Mobile sends `{ type: 'file-uploaded', file: { s3Url, fileName, mimeType, size } }` via socket
   - Desktop receives and adds file to upload component

### Socket Adapter Interface

Host applications must implement `TisSocketAdapter`:

```typescript
interface TisSocketAdapter {
  // Required
  subscribeToChannel(channelName: string): Observable<any>;
  unsubscribeFromChannel(channelName: string): void;
  getDeviceId(): string | Promise<string>;
  isConnected(): boolean;
  connectionStatus$: Observable<boolean>;
  
  // Required for sending handshake responses
  sendViaSocket(message: { action: string; data: any }): void;
  
  // Required for QR generation
  getUserId(): string | Promise<string>;
  getApiUrl(): string;
  
  // Optional
  getSocketUrl?(): string;
  getAuthToken?(): string | null;
  getRefreshToken?(): string | null;
  subscribeToChannelPrefix?(prefix: string): Observable<any>;
}
```

## Development Commands

### Library Development

```bash
# Build library
ng build tis-image-and-file-upload-and-view

# Build library in watch mode
ng build tis-image-and-file-upload-and-view --watch

# Run demo app (for testing library)
npm start
# or
ng serve
```

### Mobile App Development

```bash
# Build mobile app
ng build tis-mobile-upload

# Serve mobile app (development)
ng serve tis-mobile-upload --port 4201

# Build for production
ng build tis-mobile-upload --configuration=production
```

### Publishing Library

```bash
# Build library for production
ng build tis-image-and-file-upload-and-view --configuration=production

# Navigate to dist folder
cd dist/tis-image-and-file-upload-and-view

# Publish to npm
npm publish
```

## Key Dependencies

### Library Dependencies
- Angular 19.x
- Angular Material
- Angular CDK (drag-drop)
- ngx-extended-pdf-viewer (PDF viewing)
- xlsx (Excel viewing)

### Mobile App Dependencies
- Angular 19.x
- Angular Material
- FingerprintJS (device identification)

## Configuration

### Library Input Properties

```typescript
// Main component inputs
@Input() urlConfig: UrlConfig;              // API endpoints
@Input() entityType: string;                 // Entity type for attachments
@Input() entityId: any;                      // Entity ID
@Input() type: 'image' | 'file' = 'image';  // Upload type
@Input() viewType: 'card' | 'list' | 'compact' = 'card';
@Input() options: OptionConfig;              // Upload options
@Input() remoteUploadConfig: TisRemoteUploadConfig; // Mobile upload config
@Input() accept: string;                     // Accepted file types
@Input() disabled: boolean;
@Input() previewOnly: boolean;
// ... more
```

### Remote Upload Configuration

```typescript
const remoteUploadConfig: TisRemoteUploadConfig = {
  enabled: true,
  socketAdapter: mySocketAdapterService,
  endpoints: {
    generateMobileLinkToken: '/api/ease-of-access/mobile-upload-link-token',
    uploadChannelPrefix: 'tis-mobile-upload-w-dev-'
  },
  qrCode: {
    mobileUploadUrl: 'https://mobile-upload.myapp.com',
    expirySeconds: 300,
    size: 200
  },
  pairing: {
    persistInStorage: true,
    pairingTTL: 86400000,
    autoReconnect: true
  }
};
```

## Related Files

- `docs/tis-socket-adapter.service.ts` - Reference adapter implementation
- `projects/tis-image-and-file-upload-and-view/src/lib/interfaces/socket-adapter.interface.ts` - Interface definitions
- `projects/tis-image-and-file-upload-and-view/src/lib/services/tis-remote-upload.service.ts` - Desktop-side pairing logic
- `projects/tis-mobile-upload/src/app/services/mobile-socket.service.ts` - Mobile-side pairing logic

## Last Updated

December 10, 2025 - Added complete remote upload feature with token-based authentication flow.
