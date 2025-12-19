# Project Architecture - TIS Image Viewer and Uploader

## Overview

This repository contains **two separate Angular applications**:

1. **Angular Library** (`@servicemind.tis/tis-image-and-file-upload-and-view`) - A reusable component library for image/file upload with desktop-mobile pairing
2. **Mobile PWA** (`tis-mobile-upload`) - A standalone Progressive Web App that allows mobile devices to upload files to the desktop library

These two apps communicate via **WebSocket** through a backend API to enable seamless file uploads from mobile devices to desktop applications.

## Workspace Structure

```
tis-image-viewer-and-uploader/
├── .github/
│   └── instructions/           # AI assistant instruction files
├── dist/                       # Built artifacts
├── docs/                       # Documentation and reference implementations
├── projects/
│   ├── tis-image-and-file-upload-and-view/   # Main library (Desktop side)
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── interfaces/           # TypeScript interfaces
│   │   │   │   ├── services/             # Core services
│   │   │   │   ├── tis-image-and-file-upload-and-view/  # Main component
│   │   │   │   ├── tis-qr-code-dialog/   # QR code dialog
│   │   │   │   ├── tis-file-viewer/      # File viewer
│   │   │   │   └── ...                   # Other components
│   │   │   └── public-api.ts             # Public exports
│   │   └── package.json
│   └── tis-mobile-upload/                # Mobile PWA (Mobile side)
│       ├── src/
│       │   ├── app/
│       │   │   ├── components/
│       │   │   │   ├── upload/           # Main upload page
│       │   │   │   ├── error/            # Error page
│       │   │   │   └── success/          # Success page
│       │   │   └── services/
│       │   │       ├── mobile-socket.service.ts   # WebSocket client
│       │   │       ├── mobile-upload.service.ts   # Upload tracker
│       │   │       └── fingerprint.service.ts     # Device ID
│       │   └── index.html
│       └── package.json
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

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DESKTOP BROWSER                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  Host Application (e.g., Angular app using the library)                             │    │
│  │  ┌─────────────────────────┐         ┌─────────────────────────────────────────┐   │    │
│  │  │ Host's SocketService    │◄───────►│ TisSocketAdapter                         │   │    │
│  │  │ (NgRx/Custom WebSocket) │         │ (implements interface, injected via DI) │   │    │
│  │  └─────────────────────────┘         └─────────────────┬───────────────────────┘   │    │
│  │                                                         │                             │    │
│  │                                                         ▼                             │    │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │ tis-image-and-file-upload-and-view Component                                 │   │    │
│  │  │                                                                               │   │    │
│  │  │  STATE: Not Connected                                                        │   │    │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐        │   │    │
│  │  │  │ [Connect Mobile] button visible                                 │        │   │    │
│  │  │  │  ↓ User clicks                                                  │        │   │    │
│  │  │  │  Opens TisQrCodeDialog                                          │        │   │    │
│  │  │  │  - Calls API to generate token                                 │        │   │    │
│  │  │  │  - Displays QR code with: token, deviceId, userId, apiUrl     │        │   │    │
│  │  │  │  - Listens for connection via WebSocket                        │        │   │    │
│  │  │  └─────────────────────────────────────────────────────────────────┘        │   │    │
│  │  │                                                                               │   │    │
│  │  │  STATE: Connected (After successful handshake)                              │   │    │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐        │   │    │
│  │  │  │ Two buttons visible:                                            │        │   │    │
│  │  │  │  1. [Upload from Mobile] - Primary action button               │        │   │    │
│  │  │  │  2. [🔗] View Connection - Icon button                          │        │   │    │
│  │  │  │                                                                  │        │   │    │
│  │  │  │ User clicks "Upload from Mobile":                              │        │   │    │
│  │  │  │  ↓                                                              │        │   │    │
│  │  │  │  - Sends field-request message to mobile via WebSocket         │        │   │    │
│  │  │  │  - Shows waiting indicator: "Waiting for upload from mobile..." │        │   │    │
│  │  │  │  - [Cancel] button available                                   │        │   │    │
│  │  │  └─────────────────────────────────────────────────────────────────┘        │   │    │
│  │  │                                                                               │   │    │
│  │  │  STATE: Waiting for Upload                                                   │   │    │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐        │   │    │
│  │  │  │ Waiting indicator + spinner displayed                           │        │   │    │
│  │  │  │ Mobile uploads file → Desktop receives "file-uploaded" message  │        │   │    │
│  │  │  └─────────────────────────────────────────────────────────────────┘        │   │    │
│  │  │                          ↓                                                    │   │    │
│  │  │  STATE: Pending Files (NEW FLOW)                                            │   │    │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐        │   │    │
│  │  │  │ Pending Files Container (Yellow background):                   │        │   │    │
│  │  │  │  📱 2 file(s) from mobile                                       │        │   │    │
│  │  │  │  ┌────────────────────────────────────────────────────────┐    │        │   │    │
│  │  │  │  │ [Preview] filename.jpg      [✓ Accept] [✗ Reject]     │    │        │   │    │
│  │  │  │  │ [Preview] document.pdf      [✓ Accept] [✗ Reject]     │    │        │   │    │
│  │  │  │  └────────────────────────────────────────────────────────┘    │        │   │    │
│  │  │  │                                                                  │        │   │    │
│  │  │  │  User clicks "Accept" on a file:                               │        │   │    │
│  │  │  │   ↓                                                             │        │   │    │
│  │  │  │   1. Calls onFileAccept(file) callback (if provided)           │        │   │    │
│  │  │  │   2. Removes from pending files list                           │        │   │    │
│  │  │  │   3. Adds to filesArray (main upload list)                     │        │   │    │
│  │  │  │   4. Shows success message                                     │        │   │    │
│  │  │  │                                                                  │        │   │    │
│  │  │  │  User clicks "Reject" on a file:                               │        │   │    │
│  │  │  │   ↓                                                             │        │   │    │
│  │  │  │   1. Removes from pending files list (no callback)             │        │   │    │
│  │  │  │   2. File is discarded                                         │        │   │    │
│  │  │  └─────────────────────────────────────────────────────────────────┘        │   │    │
│  │  │                                                                               │   │    │
│  │  │  User clicks "View Connection":                                             │   │    │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐        │   │    │
│  │  │  │ Opens dialog showing:                                           │        │   │    │
│  │  │  │  - Connection status: "Connected to mobile device"             │        │   │    │
│  │  │  │  - [Disconnect] button                                          │        │   │    │
│  │  │  │  - [Close] button                                               │        │   │    │
│  │  │  └─────────────────────────────────────────────────────────────────┘        │   │    │
│  │  └──────────────────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │ TisRemoteUploadService (Desktop-side WebSocket Manager)                      │   │    │
│  │  │                                                                               │   │    │
│  │  │  Key Observables:                                                            │   │    │
│  │  │  - remoteUpload$: BehaviorSubject<TisRemoteUploadEvent>                     │   │    │
│  │  │    (emits when file is ACCEPTED by user)                                    │   │    │
│  │  │  - pendingFiles$: BehaviorSubject<TisRemoteUploadEvent[]>                   │   │    │
│  │  │    (holds files waiting for accept/reject)                                  │   │    │
│  │  │  - isWaitingForUpload$: BehaviorSubject<boolean>                            │   │    │
│  │  │  - connectionState$: BehaviorSubject<ConnectionState>                       │   │    │
│  │  │                                                                               │   │    │
│  │  │  Key Methods:                                                                │   │    │
│  │  │  - sendFieldRequest(fieldInfo) → sends "field-request" to mobile            │   │    │
│  │  │  - acceptPendingFile(file) → calls onFileAccept, emits to remoteUpload$    │   │    │
│  │  │  - rejectPendingFile(file) → removes from pending                           │   │    │
│  │  │  - handleUploadComplete(event) → adds to pendingFiles$ (not direct emit)   │   │    │
│  │  └──────────────────────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              │ WebSocket Messages
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     │                        │                        │
                     ▼                        ▼                        ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                  AWS BACKEND API                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐    │
│  │  REST API Endpoints:                                                              │    │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │ POST /ease-of-access/mobile-upload-link-token                              │  │    │
│  │  │ - Desktop calls to generate pairing token                                  │  │    │
│  │  │ - Request: { deviceId, userId }                                            │  │    │
│  │  │ - Response: { token: UUID, expiresAt: timestamp }                          │  │    │
│  │  │ - Stores in DB with TTL                                                    │  │    │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │    │
│  │                                                                                    │    │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │ POST /ease-of-access/generate-login-and-refresh-token-for-mobile-link-app │  │    │
│  │  │ - Mobile calls with token to get credentials                               │  │    │
│  │  │ - Request: { token, mobileDeviceId }                                       │  │    │
│  │  │ - Response: { accessToken, refreshToken, socketUrl, userId, deviceId }    │  │    │
│  │  │ - Validates token, creates session                                         │  │    │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │    │
│  │                                                                                    │    │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │ POST /api/get-presigned-url-for-mobile-upload                              │  │    │
│  │  │ - Mobile calls to get S3 upload URL (NOT stored in DB)                    │  │    │
│  │  │ - Request: { fileName, mimeType, userId, entityType?, entityId? }         │  │    │
│  │  │ - Response: { uploadUrl: S3_PRESIGNED_URL, resourceUrl, fileName }        │  │    │
│  │  │ - Parameters: entityType and entityId are OPTIONAL (can be null)          │  │    │
│  │  │ - Flag: storedInDB = false (file not saved to database)                   │  │    │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │    │
│  │                                                                                    │    │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │ POST /api/mobile-upload-success                                            │  │    │
│  │  │ - Mobile calls after successful S3 upload                                  │  │    │
│  │  │ - Request: { fileName, s3Url, mimeType, size, desktopDeviceId }          │  │    │
│  │  │ - Broadcasts "file-uploaded" message to desktop via WebSocket             │  │    │
│  │  │ - No database storage (file metadata only sent to desktop)                │  │    │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐    │
│  │  WebSocket API (AWS API Gateway WebSocket)                                       │    │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │ Channel Pattern: tis-mobile-upload-w-dev-{desktopDeviceId}                │  │    │
│  │  │                                                                            │  │    │
│  │  │ Message Types:                                                             │  │    │
│  │  │                                                                            │  │    │
│  │  │ 1. connectionState (Mobile → Desktop):                                    │  │    │
│  │  │    { type: 'connectionState', connectionState: 'INITIATED',              │  │    │
│  │  │      mobileDeviceId, timestamp }                                          │  │    │
│  │  │                                                                            │  │    │
│  │  │ 2. connectionState (Desktop → Mobile):                                    │  │    │
│  │  │    { type: 'connectionState', connectionState: 'SUCCESS',                │  │    │
│  │  │      desktopDeviceId, timestamp }                                         │  │    │
│  │  │                                                                            │  │    │
│  │  │ 3. field-request (Desktop → Mobile):                                      │  │    │
│  │  │    { type: 'field-request', fieldInfo: {                                 │  │    │
│  │  │      label, accept, type, entityType?, entityId?,                        │  │    │
│  │  │      isMultiple, limit, remainingSlots, isCompressed                     │  │    │
│  │  │    }, timestamp }                                                         │  │    │
│  │  │                                                                            │  │    │
│  │  │ 4. file-uploaded (Backend → Desktop) - via mobile-upload-success API:    │  │    │
│  │  │    { type: 'file-uploaded', file: {                                      │  │    │
│  │  │      s3Url, fileName, mimeType, size, uploadData                         │  │    │
│  │  │    }, mobileDeviceId, timestamp }                                         │  │    │
│  │  │                                                                            │  │    │
│  │  │ 5. cancel-request (Desktop → Mobile):                                     │  │    │
│  │  │    { type: 'cancel-request', timestamp }                                  │  │    │
│  │  │                                                                            │  │    │
│  │  │ 6. disconnect (Either → Other):                                           │  │    │
│  │  │    { type: 'disconnect', reason, timestamp }                              │  │    │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              │ QR Code Scan & WebSocket
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              MOBILE BROWSER (PWA)                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐    │
│  │  tis-mobile-upload App (Angular PWA)                                              │    │
│  │                                                                                    │    │
│  │  FLOW 1: Initial Connection                                                       │    │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │ 1. User scans QR code from desktop                                         │  │    │
│  │  │    QR contains: ?token={uuid}&deviceId={desktop}&userId={id}&apiUrl={api} │  │    │
│  │  │                                                                            │  │    │
│  │  │ 2. App parses URL params → UploadComponent                                │  │    │
│  │  │                                                                            │  │    │
│  │  │ 3. FingerprintService generates unique mobile device ID                   │  │    │
│  │  │                                                                            │  │    │
│  │  │ 4. MobileSocketService:                                                   │  │    │
│  │  │    - Calls generate-login-and-refresh-token API with token               │  │    │
│  │  │    - Receives accessToken, refreshToken, socketUrl                       │  │    │
│  │  │    - Connects to WebSocket with credentials                              │  │    │
│  │  │    - Subscribes to channel: tis-mobile-upload-w-dev-{desktopDeviceId}   │  │    │
│  │  │    - Sends connectionState: INITIATED                                     │  │    │
│  │  │                                                                            │  │    │
│  │  │ 5. Waits for SUCCESS response from desktop                               │  │    │
│  │  │    - Shows "Connected" status in UI                                      │  │    │
│  │  │    - Stores session in localStorage                                      │  │    │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │    │
│  │                                                                                    │    │
│  │  FLOW 2: Receiving Upload Request (NEW)                                          │    │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │ 1. Desktop sends "field-request" message via WebSocket                    │  │    │
│  │  │                                                                            │  │    │
│  │  │ 2. Mobile receives field-request with:                                    │  │    │
│  │  │    { label, accept, type, entityType?, entityId?,                        │  │    │
│  │  │      isMultiple, limit, isCompressed }                                   │  │    │
│  │  │                                                                            │  │    │
│  │  │ 3. UploadComponent shows upload UI:                                       │  │    │
│  │  │    - Uses TIS LIBRARY component for upload                               │  │    │
│  │  │      <tis-image-and-file-upload-and-view                                 │  │    │
│  │  │        [urlConfig]="urlConfig"                                           │  │    │
│  │  │        [type]="fieldRequest.type"                                        │  │    │
│  │  │        [accept]="fieldRequest.accept"                                    │  │    │
│  │  │        [options]="{ isMultiple: fieldRequest.isMultiple,                │  │    │
│  │  │                     limit: fieldRequest.limit,                           │  │    │
│  │  │                     isCompressed: fieldRequest.isCompressed,             │  │    │
│  │  │                     storedInDB: false }"                                 │  │    │
│  │  │        entityType="" entityId=""                                         │  │    │
│  │  │        (onUploaded)="handleUploadComplete($event)">                      │  │    │
│  │  │      </tis-image-and-file-upload-and-view>                               │  │    │
│  │  │                                                                            │  │    │
│  │  │    Note: entityType and entityId are EMPTY/NULL                          │  │    │
│  │  │          storedInDB is FALSE (no database storage)                       │  │    │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │    │
│  │                                                                                    │    │
│  │  FLOW 3: File Upload via Library                                                 │    │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │ 1. User selects file(s) via library component                            │  │    │
│  │  │                                                                            │  │    │
│  │  │ 2. Library component internally:                                          │  │    │
│  │  │    a) Calls urlConfig.getPresignedUrl endpoint:                          │  │    │
│  │  │       POST /api/get-presigned-url-for-mobile-upload                      │  │    │
│  │  │       { fileName, mimeType, userId, entityType: null, entityId: null }   │  │    │
│  │  │                                                                            │  │    │
│  │  │    b) Backend generates S3 presigned URL (NO DB STORAGE)                 │  │    │
│  │  │       Returns: { uploadUrl, resourceUrl, fileName }                      │  │    │
│  │  │                                                                            │  │    │
│  │  │    c) Library uploads file directly to S3 via presigned URL              │  │    │
│  │  │       PUT {uploadUrl} with file binary                                   │  │    │
│  │  │                                                                            │  │    │
│  │  │    d) Library emits onUploaded event with file data                      │  │    │
│  │  │                                                                            │  │    │
│  │  │ 3. Mobile UploadComponent.handleUploadComplete():                        │  │    │
│  │  │    - Receives upload event from library                                  │  │    │
│  │  │    - Calls POST /api/mobile-upload-success with:                         │  │    │
│  │  │      { fileName, s3Url, mimeType, size, desktopDeviceId }               │  │    │
│  │  │                                                                            │  │    │
│  │  │ 4. Backend receives mobile-upload-success:                               │  │    │
│  │  │    - Broadcasts "file-uploaded" message to desktop via WebSocket        │  │    │
│  │  │    - Desktop receives file as PENDING                                    │  │    │
│  │  │                                                                            │  │    │
│  │  │ 5. Mobile shows success message, ready for next upload                   │  │    │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │    │
│  │                                                                                    │    │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │ MobileSocketService (Mobile-side WebSocket Manager)                       │  │    │
│  │  │                                                                            │  │    │
│  │  │  Key Properties:                                                          │  │    │
│  │  │  - connectionState$: BehaviorSubject<ConnectionState>                    │  │    │
│  │  │  - currentFieldRequest$: BehaviorSubject<FieldRequest | null>            │  │    │
│  │  │  - desktopDeviceId: string (from QR code)                                │  │    │
│  │  │  - mobileDeviceId: string (from FingerprintService)                      │  │    │
│  │  │                                                                            │  │    │
│  │  │  Key Methods:                                                             │  │    │
│  │  │  - connectWithToken(token, deviceId, userId, apiUrl)                     │  │    │
│  │  │  - subscribeToMessages() → listens for field-request, cancel-request     │  │    │
│  │  │  - notifyUploadSuccess(fileData) → calls mobile-upload-success API       │  │    │
│  │  │  - disconnect()                                                           │  │    │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Connection State Machine

```
Desktop States:
┌─────────────────┐
│ DISCONNECTED    │ Initial state, no mobile paired
└────────┬────────┘
         │ User clicks "Connect Mobile" → Opens QR Dialog
         ▼
┌─────────────────┐
│ WAITING_FOR_    │ QR displayed, waiting for mobile to scan
│ CONNECTION      │
└────────┬────────┘
         │ Mobile sends INITIATED
         ▼
┌─────────────────┐
│ CONNECTED       │ Handshake complete, mobile paired
└────────┬────────┘
         │ User clicks "Upload from Mobile"
         ▼
┌─────────────────┐
│ WAITING_FOR_    │ field-request sent, spinner shown
│ UPLOAD          │
└────────┬────────┘
         │ Mobile uploads file → file-uploaded received
         ▼
┌─────────────────┐
│ PENDING_FILES   │ Files shown with Accept/Reject buttons
└────────┬────────┘
         │ User accepts/rejects all files
         ▼
┌─────────────────┐
│ CONNECTED       │ Back to connected state, ready for next upload
└─────────────────┘

Mobile States:
┌─────────────────┐
│ DISCONNECTED    │ Initial state
└────────┬────────┘
         │ User scans QR code
         ▼
┌─────────────────┐
│ CONNECTING      │ Getting credentials, establishing WebSocket
└────────┬────────┘
         │ Sends INITIATED, waits for SUCCESS
         ▼
┌─────────────────┐
│ CONNECTED       │ Paired with desktop, waiting for field-request
└────────┬────────┘
         │ Receives field-request
         ▼
┌─────────────────┐
│ UPLOAD_READY    │ Shows upload UI via library component
└────────┬────────┘
         │ User selects files
         ▼
┌─────────────────┐
│ UPLOADING       │ Files uploading to S3
└────────┬────────┘
         │ Upload complete → calls mobile-upload-success API
         ▼
┌─────────────────┐
│ UPLOAD_SUCCESS  │ Shows success message
└────────┬────────┘
         │ Auto return after 2 seconds
         ▼
┌─────────────────┐
│ CONNECTED       │ Ready for next field-request
└─────────────────┘
```

### Sequence Diagram: Complete Upload Flow

```
Desktop          Backend          Mobile           S3
  │                │                │               │
  │─────────────►│                │               │
  │ Generate Token│                │               │
  │◄─────────────│                │               │
  │ {token}       │                │               │
  │                │                │               │
  │ Show QR       │                │               │
  │                │                │               │
  │                │◄───────────────│               │
  │                │ Get Credentials│               │
  │                │ {token}        │               │
  │                │────────────────►│               │
  │                │ {accessToken}  │               │
  │                │                │               │
  │                │    WebSocket   │               │
  │                │◄──────────────►│               │
  │                │                │               │
  │◄───────────────┼────────────────│               │
  │ connectionState: INITIATED      │               │
  │────────────────┼───────────────►│               │
  │ connectionState: SUCCESS        │               │
  │                │                │               │
  │ User clicks    │                │               │
  │ "Upload from   │                │               │
  │ Mobile"        │                │               │
  │────────────────┼───────────────►│               │
  │ field-request  │                │               │
  │                │                │               │
  │                │                │ User selects  │
  │                │                │ file          │
  │                │                │               │
  │                │◄───────────────│               │
  │                │ Get presigned  │               │
  │                │ URL (no DB)    │               │
  │                │────────────────►│               │
  │                │ {uploadUrl}    │               │
  │                │                │               │
  │                │                │───────────────►│
  │                │                │ PUT file      │
  │                │                │◄───────────────│
  │                │                │ 200 OK        │
  │                │                │               │
  │                │◄───────────────│               │
  │                │ mobile-upload- │               │
  │                │ success        │               │
  │◄───────────────│                │               │
  │ file-uploaded  │                │               │
  │ (PENDING)      │                │               │
  │                │                │               │
  │ Desktop shows  │                │               │
  │ Accept/Reject  │                │               │
  │ UI             │                │               │
  │                │                │               │
  │ User clicks    │                │               │
  │ "Accept"       │                │               │
  │                │                │               │
  │ Calls          │                │               │
  │ onFileAccept() │                │               │
  │ callback       │                │               │
  │                │                │               │
  │ Adds to        │                │               │
  │ filesArray     │                │               │
  └────────────────┴────────────────┴───────────────┘
```

### LocalStorage Keys

#### Desktop (Library)
- `tis-remote-upload-paired-devices` - Array of paired mobile devices with session info
  ```json
  [{
    "mobileDeviceId": "fp_abc123",
    "pairedAt": 1734566400000,
    "lastSeen": 1734570000000,
    "deviceInfo": { "userAgent": "...", "platform": "..." }
  }]
  ```
- `tis-remote-upload-session-{mobileDeviceId}` - Active session data
  ```json
  {
    "desktopDeviceId": "desktop_xyz",
    "mobileDeviceId": "fp_abc123",
    "userId": "user123",
    "connectedAt": 1734566400000,
    "expiresAt": 1734652800000
  }
  ```

#### Mobile (PWA)
- `tis-mobile-upload-session` - Current connection session
  ```json
  {
    "desktopDeviceId": "desktop_xyz",
    "mobileDeviceId": "fp_abc123",
    "userId": "user123",
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "socketUrl": "wss://...",
    "connectedAt": 1734566400000,
    "expiresAt": 1734652800000
  }
  ```
- `tis-mobile-fingerprint` - Unique mobile device identifier (persisted across sessions)

### Pairing Flow (Token-Based Authentication)

1. **Desktop generates token:**
   - User clicks "Connect Mobile" button in library component
   - Component calls `TisRemoteUploadService.openQrDialog()`
   - Service calls `POST /ease-of-access/mobile-upload-link-token` with `{ deviceId, userId }`
   - Backend generates UUID token, stores in DB with TTL (typically 5 minutes)
   - Returns `{ token, expiresAt }`
   - QR dialog opens and displays QR code

2. **QR Code contains:**
   ```
   https://mobile-upload.example.com?token=abc-123-def&deviceId=desktop_xyz&userId=user123&apiUrl=https://api.example.com
   ```

3. **Mobile scans QR:**
   - PWA opens with query params parsed from QR code
   - `FingerprintService` generates unique mobile device ID (cached in localStorage)
   - `MobileSocketService.connectWithToken()` called
   - Calls `POST /ease-of-access/generate-login-and-refresh-token-for-mobile-link-app`
     - Request: `{ token, mobileDeviceId }`
     - Response: `{ accessToken, refreshToken, socketUrl, userId, deviceId }`
   - Stores session in localStorage

4. **Mobile establishes WebSocket:**
   - Connects to `socketUrl` with `accessToken` in headers
   - Subscribes to channel: `tis-mobile-upload-w-dev-{desktopDeviceId}`
   - Sends handshake: `{ type: 'connectionState', connectionState: 'INITIATED', mobileDeviceId, timestamp }`

5. **Desktop acknowledges handshake:**
   - Desktop's `TisSocketAdapter` receives INITIATED message via subscribed channel
   - `TisRemoteUploadService` processes message
   - Responds with: `{ type: 'connectionState', connectionState: 'SUCCESS', desktopDeviceId, timestamp }`
   - Updates `connectionState$` to CONNECTED
   - QR dialog shows "Connected" status (auto-closes if configured)

6. **Connection persisted:**
   - Desktop stores paired device info in localStorage
   - Mobile stores session info in localStorage
   - Both apps show connected status
   - Connection remains active until explicit disconnect or timeout

### Upload Flow (with Pending Files - NEW)

**Phase 1: Request Upload**
1. Desktop user clicks **"Upload from Mobile"** button
2. Desktop sends `field-request` message via WebSocket:
   ```json
   {
     "type": "field-request",
     "fieldInfo": {
       "label": "Upload Images",
       "accept": "image/*",
       "type": "image",
       "entityType": null,
       "entityId": null,
       "isMultiple": true,
       "limit": 5,
       "remainingSlots": 5,
       "isCompressed": true
     },
     "timestamp": 1734566400000
   }
   ```
3. Desktop shows **waiting indicator** with spinner
4. Mobile receives `field-request` message
5. Mobile displays upload UI using **TIS Library component**

**Phase 2: File Upload (Mobile)**
6. Mobile user selects file(s) via library component
7. Library component (running on mobile) performs upload:
   - Calls `POST /api/get-presigned-url-for-mobile-upload`
     - Request: `{ fileName, mimeType, userId, entityType: null, entityId: null }`
     - **Important**: No entityType/entityId, `storedInDB: false`
   - Receives: `{ uploadUrl, resourceUrl, fileName }`
   - Uploads file to S3 using presigned URL
   - Emits `onUploaded` event with file metadata
8. Mobile component catches `onUploaded` event
9. Mobile calls `POST /api/mobile-upload-success`:
   ```json
   {
     "fileName": "photo.jpg",
     "s3Url": "https://s3.amazonaws.com/bucket/path/photo.jpg",
     "mimeType": "image/jpeg",
     "size": 2048576,
     "desktopDeviceId": "desktop_xyz"
   }
   ```
10. Backend broadcasts `file-uploaded` message to desktop via WebSocket:
    ```json
    {
      "type": "file-uploaded",
      "file": {
        "s3Url": "https://s3.amazonaws.com/...",
        "fileName": "photo.jpg",
        "mimeType": "image/jpeg",
        "size": 2048576,
        "uploadData": { ... }
      },
      "mobileDeviceId": "fp_abc123",
      "timestamp": 1734566410000
    }
    ```

**Phase 3: Pending Files (Desktop - NEW)**
11. Desktop receives `file-uploaded` message
12. `TisRemoteUploadService.handleUploadComplete()` adds file to `pendingFiles$` (NOT directly to `remoteUpload$`)
13. Component subscribes to `pendingFiles$` and displays:
    ```
    📱 1 file(s) from mobile
    ┌────────────────────────────────────┐
    │ [preview] photo.jpg                │
    │           [✓ Accept] [✗ Reject]    │
    └────────────────────────────────────┘
    ```
14. Desktop hides **waiting indicator**, shows **pending files container**

**Phase 4: User Decision**
15. User clicks **"Accept"** button:
    - Component calls `acceptPendingFile(pendingFile)`
    - Service calls `onFileAccept(file)` callback (if provided by host app)
    - Service removes from `pendingFiles$`
    - Service emits to `remoteUpload$`
    - Component's subscription to `remoteUpload$` adds file to `filesArray`
    - Shows success snackbar message
    
    **OR** User clicks **"Reject"** button:
    - Component calls `rejectPendingFile(pendingFile)`
    - Service removes from `pendingFiles$`
    - File is discarded (no callback, no addition to filesArray)

16. When all pending files are processed, returns to **CONNECTED** state
17. Ready for next "Upload from Mobile" request

### Socket Adapter Interface (Desktop)

Host applications integrating the library **must implement** `TisSocketAdapter` to connect the library to their WebSocket infrastructure:

```typescript
export interface TisSocketAdapter {
  // ==================== Required Methods ====================
  
  /**
   * Subscribe to a specific WebSocket channel
   * @param channelName - Full channel name (e.g., "tis-mobile-upload-w-dev-desktop_xyz")
   * @returns Observable that emits messages received on this channel
   */
  subscribeToChannel(channelName: string): Observable<any>;
  
  /**
   * Unsubscribe from a WebSocket channel
   * @param channelName - Channel to unsubscribe from
   */
  unsubscribeFromChannel(channelName: string): void;
  
  /**
   * Get the unique desktop device identifier
   * @returns Device ID string or Promise resolving to device ID
   */
  getDeviceId(): string | Promise<string>;
  
  /**
   * Check if WebSocket is currently connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean;
  
  /**
   * Observable that emits connection status changes
   * Emits true when connected, false when disconnected
   */
  connectionStatus$: Observable<boolean>;
  
  /**
   * Send a message via WebSocket
   * Used for handshake responses and control messages
   * @param message - Message object with action and data
   */
  sendViaSocket(message: { action: string; data: any }): void;
  
  /**
   * Get the current user's ID
   * Used for token generation and QR code
   * @returns User ID string or Promise resolving to user ID
   */
  getUserId(): string | Promise<string>;
  
  /**
   * Get the API base URL
   * Used for generating mobile upload URL in QR code
   * @returns API base URL (e.g., "https://api.example.com")
   */
  getApiUrl(): string;
  
  // ==================== Optional Methods ====================
  
  /**
   * Get the WebSocket server URL (optional)
   * If not provided, backend will return socketUrl in token exchange
   */
  getSocketUrl?(): string;
  
  /**
   * Get the current authentication token (optional)
   * Used for authenticated API calls
   */
  getAuthToken?(): string | null;
  
  /**
   * Get the refresh token (optional)
   * Used for token refresh
   */
  getRefreshToken?(): string | null;
  
  /**
   * Subscribe to all channels matching a prefix pattern (optional)
   * Useful for listening to multiple device channels
   * @param prefix - Channel prefix (e.g., "tis-mobile-upload-w-dev-")
   */
  subscribeToChannelPrefix?(prefix: string): Observable<any>;
}
```

**Example Implementation:**
```typescript
@Injectable({ providedIn: 'root' })
export class MySocketAdapterService implements TisSocketAdapter {
  connectionStatus$ = new BehaviorSubject<boolean>(false);
  
  constructor(
    private socketService: MyWebSocketService,
    private authService: AuthService
  ) {}
  
  subscribeToChannel(channelName: string): Observable<any> {
    return this.socketService.subscribe(channelName);
  }
  
  unsubscribeFromChannel(channelName: string): void {
    this.socketService.unsubscribe(channelName);
  }
  
  sendViaSocket(message: { action: string; data: any }): void {
    this.socketService.send(message);
  }
  
  getDeviceId(): string {
    return this.authService.getDeviceId();
  }
  
  getUserId(): string {
    return this.authService.getCurrentUserId();
  }
  
  getApiUrl(): string {
    return environment.apiUrl;
  }
  
  isConnected(): boolean {
    return this.socketService.isConnected;
  }
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

### Library Input Properties (Desktop Component)

```typescript
// ==================== Core Configuration ====================

@Input() urlConfig: UrlConfig;              
// API endpoints for file operations
// Required properties:
//   - getPresignedUrl: string (endpoint to get S3 presigned URL)
//   - uploadSuccess?: string (callback after successful upload)

@Input() entityType: string;                 
// Entity type for file attachments (e.g., "order", "user", "ticket")
// Can be empty/null for mobile uploads (no DB storage)

@Input() entityId: any;                      
// Entity ID for file attachments (e.g., order ID, user ID)
// Can be empty/null for mobile uploads (no DB storage)

@Input() type: 'image' | 'file' = 'image';  
// Type of upload: 'image' restricts to image files, 'file' allows all types

@Input() viewType: 'card' | 'list' | 'compact' = 'card';
// Display layout:
//   - 'card': Grid of cards with large previews
//   - 'list': Vertical list with smaller previews
//   - 'compact': Minimal compact view

// ==================== Behavior Options ====================

@Input() options: OptionConfig;              
// Upload options (see OptionConfig interface below)

@Input() accept: string = '';                     
// Accepted file types (e.g., "image/*", ".pdf,.doc", "image/jpeg,image/png")

@Input() disabled: boolean = false;
// Disable upload functionality

@Input() previewOnly: boolean = false;
// Show files without upload/delete controls

@Input() required: boolean = false;
// Mark field as required (shows error border when empty)

@Input() label: string | null = null;
// Field label displayed in upload area

@Input() hint: string | null = null;
// Hint text displayed below label

@Input() isValidateMimeType: boolean = true;
// Validate file MIME types against accept property

@Input() isAddUploadedFileInLastNode: boolean = false;
// Add new uploads at end (true) or beginning (false) of list

@Input() isEnableDeleteConfirmation: boolean = true;
// Show confirmation dialog before deleting files

@Input() deleteConfirmationMsg: string;
// Custom delete confirmation message

@Input() isEnableCapture: boolean = false;
// Enable camera capture for images (mobile)

@Input() isShowImageSequence: boolean = false;
// Show sequence numbers on images

@Input() enableDragNDrop: boolean = false;
// Enable drag-and-drop reordering

@Input() showDeleteButtonWhenDisabled: boolean = false;
// Show delete buttons even when disabled=true

@Input() previewInFlex: boolean = false;
// Use flexbox layout for previews

@Input() imageItemClass: string = '';
// Custom CSS class for image items

// ==================== Remote Upload (Desktop-Mobile) ====================

@Input() remoteUploadConfig: TisRemoteUploadConfig | null = null;
// Configuration for mobile upload feature (see below)

// ==================== Output Events ====================

@Output() uploadInProgress = new EventEmitter();
// Emitted when upload starts

@Output() onUploaded = new EventEmitter();
// Emitted when file successfully uploads

@Output() onFileSelect = new EventEmitter<any>();
// Emitted when file is selected (before upload)

@Output() onFileRemoved = new EventEmitter<any>();
// Emitted when file is deleted

@Output() onError = new EventEmitter();
// Emitted on upload errors

@Output() onRemoteUpload = new EventEmitter<TisRemoteUploadEvent>();
// Emitted when file is accepted from mobile upload

@Output() dataSequenceChange = new EventEmitter<any>();
// Emitted when file order changes (drag-drop)
```

### OptionConfig Interface

```typescript
interface OptionConfig {
  isMultiple?: boolean;          // Allow multiple file uploads (default: false)
  limit?: number;                // Maximum number of files (default: 10)
  isCompressed?: boolean;        // Compress images before upload (default: false)
  isStoredDb?: boolean;         // Store file metadata in database (default: true)
  selectionMode?: boolean;       // Enable file selection mode (default: false)
  hiddenDeleteBtn?: boolean;     // Hide delete buttons (default: false)
  hiddenPreview?: boolean;       // Hide preview functionality (default: false)
  cols?: number;                 // Grid columns for card view (default: 5)
  colsForTab?: number;           // Grid columns for tablet (default: 5)
  colsForMobile?: number;        // Grid columns for mobile (default: 3)
  height?: string;               // Upload area height (default: '130px')
  enableImageTags?: boolean;     // Enable image tagging feature (default: false)
  useAdvancedCamera?: boolean;   // Use advanced camera modal (default: true)
}
```

### TisRemoteUploadConfig Interface (NEW with onFileAccept)

```typescript
interface TisRemoteUploadConfig {
  // ==================== Required ====================
  
  enabled: boolean;
  // Enable remote upload feature
  
  socketAdapter: TisSocketAdapter;
  // Implementation of TisSocketAdapter interface (provided by host app)
  
  // ==================== Optional ====================
  
  endpoints?: {
    generateMobileLinkToken?: string;
    // API endpoint to generate pairing token
    // Default: '/api/ease-of-access/mobile-upload-link-token'
    
    uploadChannelPrefix?: string;
    // WebSocket channel prefix
    // Default: 'tis-mobile-upload-w-dev-'
  };
  
  qrCode?: {
    mobileUploadUrl?: string;
    // URL to mobile PWA (included in QR code)
    // Default: Uses current origin + '/mobile-upload'
    
    expirySeconds?: number;
    // Token expiry time in seconds
    // Default: 300 (5 minutes)
    
    size?: number;
    // QR code size in pixels
    // Default: 200
  };
  
  pairing?: {
    persistInStorage?: boolean;
    // Store paired devices in localStorage
    // Default: true
    
    pairingTTL?: number;
    // Pairing time-to-live in milliseconds
    // Default: 86400000 (24 hours)
    
    autoReconnect?: boolean;
    // Auto-reconnect to last paired device on page load
    // Default: true
  };
  
  // ==================== NEW: File Accept Callback ====================
  
  onFileAccept?: (file: TisRemoteUploadedFile) => void;
  // Callback invoked when user accepts a pending file from mobile
  // Called BEFORE file is added to the component's filesArray
  // Use this to:
  //   - Validate the file
  //   - Log to analytics
  //   - Update application state
  //   - Show custom notifications
  // 
  // Example:
  //   onFileAccept: (file) => {
  //     console.log('User accepted file:', file.fileName);
  //     this.analytics.track('mobile_file_accepted', { fileName: file.fileName });
  //     this.store.dispatch(addFile({ file }));
  //   }
}

interface TisRemoteUploadedFile {
  s3Url: string;              // S3 URL where file is stored
  fileName: string;           // Original filename
  mimeType: string;           // File MIME type
  size: number;               // File size in bytes
  uploadData?: any;           // Additional upload metadata
}
```

### Example Component Usage

```typescript
@Component({
  selector: 'app-my-form',
  template: `
    <tis-image-and-file-upload-and-view
      [urlConfig]="urlConfig"
      [entityType]="'order'"
      [entityId]="orderId"
      [type]="'image'"
      [viewType]="'card'"
      [options]="uploadOptions"
      [remoteUploadConfig]="remoteUploadConfig"
      [accept]="'image/*'"
      [label]="'Upload Order Photos'"
      [hint]="'Max 5 images, JPEG or PNG only'"
      [required]="true"
      (onUploaded)="handleUpload($event)"
      (onRemoteUpload)="handleRemoteUpload($event)"
      (onError)="handleError($event)">
    </tis-image-and-file-upload-and-view>
  `
})
export class MyFormComponent {
  orderId = 12345;
  
  urlConfig: UrlConfig = {
    getPresignedUrl: '/api/get-presigned-url',
    uploadSuccess: '/api/upload-success'
  };
  
  uploadOptions: OptionConfig = {
    isMultiple: true,
    limit: 5,
    isCompressed: true,
    isStoredDb: true,
    cols: 3,
    height: '150px'
  };
  
  remoteUploadConfig: TisRemoteUploadConfig = {
    enabled: true,
    socketAdapter: this.mySocketAdapter,
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
    },
    // NEW: Callback when user accepts file from mobile
    onFileAccept: (file) => {
      console.log('User accepted mobile upload:', file.fileName);
      
      // Track in analytics
      this.analytics.track('mobile_file_accepted', {
        fileName: file.fileName,
        fileSize: file.size,
        orderId: this.orderId
      });
      
      // Update NgRx store
      this.store.dispatch(addOrderAttachment({
        orderId: this.orderId,
        file: file
      }));
      
      // Show custom notification
      this.notificationService.success(
        `File "${file.fileName}" added from mobile device`
      );
    }
  };
  
  constructor(
    private mySocketAdapter: MySocketAdapterService,
    private analytics: AnalyticsService,
    private store: Store,
    private notificationService: NotificationService
  ) {}
  
  handleUpload(event: any) {
    console.log('File uploaded:', event);
  }
  
  handleRemoteUpload(event: TisRemoteUploadEvent) {
    console.log('Remote upload accepted:', event);
  }
  
  handleError(error: any) {
    console.error('Upload error:', error);
  }
}
```

## Related Files & Important Paths

### Desktop Library Files
```
projects/tis-image-and-file-upload-and-view/src/lib/
├── interfaces/
│   ├── socket-adapter.interface.ts       # TisSocketAdapter interface definition
│   ├── config.type.ts                    # UrlConfig, OptionConfig interfaces
│   ├── file-viewer-file-type.type.ts    # File type definitions
│   └── index.ts                          # Public exports
├── services/
│   ├── tis-remote-upload.service.ts      # Desktop-side WebSocket manager
│   │                                     # Key methods: sendFieldRequest, acceptPendingFile,
│   │                                     # rejectPendingFile, handleUploadComplete
│   └── tis-helper.service.ts             # Utility functions
├── tis-image-and-file-upload-and-view/
│   ├── tis-image-and-file-upload-and-view.component.ts
│   │                                     # Main upload component
│   │                                     # Handles pending files UI and accept/reject
│   ├── tis-image-and-file-upload-and-view.component.html
│   │                                     # Template with pending files section
│   └── tis-image-and-file-upload-and-view.component.css
│                                         # Styles including .pending-files-container
├── tis-qr-code-dialog/
│   ├── tis-qr-code-dialog.component.ts   # QR code display dialog
│   └── tis-qr-code-dialog.component.html
├── tis-file-viewer/                      # File preview components
├── tis-preview-image/                    # Image preview with zoom
└── public-api.ts                         # Library public exports
```

### Mobile PWA Files
```
projects/tis-mobile-upload/src/app/
├── components/
│   ├── upload/
│   │   ├── upload.component.ts           # Main upload page
│   │   │                                 # Uses TIS library for file upload
│   │   │                                 # Calls mobile-upload-success API
│   │   └── upload.component.html
│   ├── error/
│   │   └── error.component.ts            # Error display page
│   └── success/
│       └── success.component.ts          # Success confirmation page
├── services/
│   ├── mobile-socket.service.ts          # Mobile WebSocket client
│   │                                     # Handles: connectWithToken, subscribeToMessages,
│   │                                     # notifyUploadSuccess
│   ├── mobile-upload.service.ts          # Upload tracking service
│   └── fingerprint.service.ts            # Device ID generation (FingerprintJS)
├── app.routes.ts                         # Routing configuration
└── app.config.ts                         # App-level configuration
```

### Reference Implementation
```
docs/
└── tis-socket-adapter.service.ts         # Example TisSocketAdapter implementation
                                          # Shows how to integrate with host app's WebSocket
```

### Configuration Files
```
angular.json                              # Workspace configuration
├── Library project: tis-image-and-file-upload-and-view
└── Mobile PWA project: tis-mobile-upload

package.json                              # Root dependencies
projects/tis-image-and-file-upload-and-view/package.json  # Library dependencies
projects/tis-mobile-upload/package.json   # Mobile app dependencies
```

## Last Updated

December 19, 2025 - Added comprehensive architecture documentation including:
- Complete flow diagrams with pending files model
- Connection state machines for both desktop and mobile
- Sequence diagram for upload flow
- NEW: onFileAccept callback in TisRemoteUploadConfig
- Detailed API endpoint documentation
- WebSocket message specifications
- LocalStorage key structures
- Full component property documentation with examples
