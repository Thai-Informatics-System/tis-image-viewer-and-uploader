# tis-image-and-file-upload-and-view

An all-in-one **image and file upload/view** Angular component by **Thai Informatic Systems Co. Ltd.**, designed for modern enterprise applications. This library provides a highly customizable drag-and-drop or button-triggered upload UI, with seamless preview and viewer integration for files including images, PDFs, videos, Excel, and more.

[![npm version](https://img.shields.io/npm/v/@servicemind.tis/tis-image-and-file-upload-and-view)](https://www.npmjs.com/package/@servicemind.tis/tis-image-and-file-upload-and-view)
[![npm downloads](https://img.shields.io/npm/dm/@servicemind.tis/tis-image-and-file-upload-and-view)](https://www.npmjs.com/package/@servicemind.tis/tis-image-and-file-upload-and-view)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🚀 Features

- ✅ Image and file upload with S3-style pre-signed URL handling
- ✅ Support for images, PDFs, Excel, CSV, videos, and raw files
- ✅ Built-in preview & viewer components
- ✅ Optional confirmation dialogs
- ✅ Fully customizable UI and dialog labels
- ✅ Support for standalone and module-based Angular apps
- ✅ Supports multiple uploads, size control, and compression toggle

---

## 📦 Installation

```bash
npm install @servicemind.tis/tis-image-and-file-upload-and-view
```

### Peer Dependencies

```bash
npm install @angular/material @angular/cdk
```

---

## 🧩 Module Setup

```ts
import { TisImageAndFileUploadAndViewModule } from '@servicemind.tis/tis-image-and-file-upload-and-view';

@NgModule({
  imports: [TisImageAndFileUploadAndViewModule]
})
export class MyFeatureModule {}
```

---

## ⚙️ Configuration Interfaces

### `UrlConfig`

```ts
export interface UrlConfig {
  getUploadUrl: string;
  attachToEntity: string;
  removeImage: string;
}
```

### `DialogConfig`

```ts
export interface DialogConfig {
  title: string;
  message: string | null;
  iconClass: string;
  icon: string;
  approveButtonText: string | null;
  approveButtonClass: string;
  cancelButtonText: string | null;
  cancelButtonClass: string;
}
```

---

## 🧠 Component: `<tis-image-and-file-upload-and-view>`

This is the main component that allows users to upload and preview files.

### ✅ Inputs

| Input         | Type                | Description |
|---------------|---------------------|-------------|
| `urlConfig`   | `UrlConfig`         | API endpoints for upload, attach, delete |
| `entityType`  | `string`            | Type of the associated entity |
| `disabled`    | `boolean`           | Disable upload actions |
| `viewType`    | `'card'`            | View format |
| `options`     | `UploadOptions`     | Visual and functional configurations |
| `accept`      | `string`            | Allowed file types (e.g., `.jpg,.png`) |
| `label`       | `string`            | Upload label |
| `data`        | `any[]`             | Existing file data to render |
| `dialogConfig`| `DialogConfig`      | Custom confirmation dialog settings |

---

## 📤 Example Usage

### HTML

```html
<tis-image-and-file-upload-and-view
  [urlConfig]="urlConfig"
  [entityType]="'announcement_details'"
  [disabled]="false"
  viewType="card"
  [options]="{
    selectorId: 'choosing-image-for-announcement-details',
    height: '108px',
    isStoredDb: false,
    isMultiple: true,
    cols: 5,
    isCompressed: false
  }"
  accept=".png,.jpeg,.jpg"
  label="Upload Image"
  [data]="files"
  [dialogConfig]="getImagePickerDialogConfig()">
</tis-image-and-file-upload-and-view>
```

### Component (TS)

```ts
urlConfig: UrlConfig = {
  getUploadUrl: 'https://your-api/get-upload-url',
  attachToEntity: 'https://your-api/attach-to-entity',
  removeImage: 'https://your-api/remove-url',
};

files = [
  {
    s3Url: 'https://bucket-url/file1.jpg',
    uploadData: {
      uploadURL: 'https://bucket-url/upload',
      fileName: 'example.jpg',
      uploadPath: '/entity/example.jpg',
      resourceUrl: 'https://bucket-url/example.jpg'
    }
  }
];

getImagePickerDialogConfig(): DialogConfig {
  return {
    title: 'Delete Image',
    message: 'Are you sure you want to delete this image?',
    iconClass: 'tis-text-danger',
    icon: 'delete',
    approveButtonText: 'Yes',
    approveButtonClass: 'tis-btn-danger',
    cancelButtonText: 'No',
    cancelButtonClass: 'tis-btn-primary'
  };
}
```

---

## 🖼️ File Types Supported

Component auto-detects and handles:

- 📄 PDF
- 📷 Images (`jpg`, `jpeg`, `png`)
- 📹 Videos
- 📊 Excel & CSV
- 📦 Raw files (opens via download or fallback preview)

---

## 🔌 Standalone App Integration

In `main.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient()
  ]
});
```

---

## 🎨 Styling

The component uses Angular Material — ensure a theme is included:

```scss
@import "~@angular/material/prebuilt-themes/indigo-pink.css";
```

---



## 📡 API Contract for Upload Integration

The component requires a pre-signed URL from your backend to upload files directly to cloud storage (like AWS S3). You must implement an API endpoint that responds with the following JSON structure:

### ✅ Sample Response from `getUploadUrl`

```json
{
  "data": {
    "uploadUrlData": {
      "uploadURL": "https://your-s3-bucket/your-object-key.jpg?...",
      "fileName": "your-object-key.jpg",
      "uploadPath": "/folder/your-object-key.jpg",
      "resourceUrl": "https://your-s3-bucket/your-object-key.jpg"
    }
  },
  "message": "Upload Url generated successfully!"
}
```

- **uploadURL**: This is the pre-signed `PUT` URL. The component will upload the file directly to this URL.
- **fileName**: Name of the file being uploaded.
- **uploadPath**: Optional path metadata for organizing resources.
- **resourceUrl**: The final public/accessible URL for accessing the uploaded file.

---

## 📤 How Upload Works Internally

When a user selects a file:

1. The component calls your `getUploadUrl` API with basic metadata (like file name/type).
2. Your backend returns a `PUT` pre-signed URL via `uploadURL`.
3. The component performs a **`PUT` request directly to that URL**, sending the image or file binary.
4. After success, the `resourceUrl` is used for rendering or viewing.

---

## 🔌 Backend API Example (Node.js)

Here’s a basic AWS S3 backend implementation in Node.js:

```js
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

app.post('/api/get-upload-url', (req, res) => {
  const fileName = req.body.fileName;
  const fileType = req.body.fileType;
  const key = `cm_cases/${uuidv4()}.${fileType.split('/')[1]}`;

  const params = {
    Bucket: 'your-s3-bucket',
    Key: key,
    ContentType: fileType,
    ACL: 'public-read',
    Expires: 900,
  };

  const uploadURL = s3.getSignedUrl('putObject', params);
  res.json({
    data: {
      uploadUrlData: {
        uploadURL,
        fileName,
        uploadPath: `/${key}`,
        resourceUrl: `https://your-s3-bucket.s3.amazonaws.com/${key}`
      }
    },
    message: "Upload Url generated successfully!"
  });
});
```

---


## 🤝 Contributing

1. Clone the repo
2. Run `npm install`
3. Use the demo app to test (`projects/` directory)
4. Submit a PR or issue with details

---

## 🚀 Publishing to npm

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build and publish to npm automatically if configured.

---

## 📬 Support / Questions

For bugs, suggestions, or feature requests, please open an issue on the [GitHub repository](https://github.com/Thai-Informatics-System/tis-image-and-file-upload-and-view).

---

> Made with ❤️ by [Thai Informatic Systems Co. Ltd](https://tis.co.th/)

