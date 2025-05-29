import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DialogConfig, OptionConfig, TisImageAndFileUploadAndViewModule, UrlConfig } from 'tis-image-and-file-upload-and-view';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, TisImageAndFileUploadAndViewModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'tis-ng-image-and-file-upload-and-view';
  selectedId = 1;
  images = [
    {
      "id": 1,
      "s3Url": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/da226bf2-4e5f-4180-94d8-6746b1ce139b.jpg",
      "title": "Image 01",
      "uploadData": {
          "isBase64Encoded": false,
          "headers": {
              "Access-Control-Allow-Origin": "*"
          },
          "uploadURL": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/da226bf2-4e5f-4180-94d8-6746b1ce139b.jpg?Content-Type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA37VN5NQI5HY4VFVN%2F20220617%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20220617T152621Z&X-Amz-Expires=900&X-Amz-Signature=4004cfb10a740b9623d486de992a06f53b458ed6fc151c092eea88a3059eae8f&X-Amz-SignedHeaders=host%3Bx-amz-acl&x-amz-acl=public-read",
          "photoFilename": "f7a32cd0-d0c1-474a-838e-47402d80527a.jpeg",
          "fileName": "1452664590074.jpeg",
          "uploadPath": "/survey_orders/f7a32cd0-d0c1-474a-838e-47402d80527a.jpeg",
          "resourceUrl": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/da226bf2-4e5f-4180-94d8-6746b1ce139b.jpg"
      }
    },
    {
      "id": 2,
      "s3Url": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/31033a2a-5db6-450d-a541-58a94654dd0c.jpg",
      "title": "Image 02",
      "uploadData": {
          "isBase64Encoded": false,
          "headers": {
              "Access-Control-Allow-Origin": "*"
          },
          "uploadURL": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql?Content-Type=application%2Fsql&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA37VN5NQI5HY4VFVN%2F20220617%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20220617T152641Z&X-Amz-Expires=900&X-Amz-Signature=bcdf347df2a6495615bf48d619492e1deac2264231161da5dc3becaa7f45a796&X-Amz-SignedHeaders=host%3Bx-amz-acl&x-amz-acl=public-read",
          "photoFilename": "6c537889-c72a-48ca-9134-638e8d6a1aac.sql",
          "fileName": "eccom_bermuda.sql",
          "uploadPath": "/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql",
          "resourceUrl": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql"
      }
    },
    {
      "id": 3,
      "s3Url": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/b8424185-30c6-4f44-ba1e-ff616dfd6576.jpg",
      "title": "Image 03",
      "uploadData": {
          "isBase64Encoded": false,
          "headers": {
              "Access-Control-Allow-Origin": "*"
          },
          "uploadURL": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/232f2548-dc93-4204-8835-86b69f3005a7.pdf?Content-Type=application%2Fpdf&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA37VN5NQI5HY4VFVN%2F20220617%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20220617T152656Z&X-Amz-Expires=900&X-Amz-Signature=85643479c3fbecc5bd1fee9783e3cb72e27e16a034921b52cf2f377eefb01ff9&X-Amz-SignedHeaders=host%3Bx-amz-acl&x-amz-acl=public-read",
          "photoFilename": "232f2548-dc93-4204-8835-86b69f3005a7.pdf",
          "fileName": "print-registration-4x6.pdf",
          "uploadPath": "/survey_orders/232f2548-dc93-4204-8835-86b69f3005a7.pdf",
          "resourceUrl": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/232f2548-dc93-4204-8835-86b69f3005a7.pdf"
      }
    }
  ];

  files = [
    {
      "id": 1,
      "s3Url": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/da226bf2-4e5f-4180-94d8-6746b1ce139b.jpg",
      "title": "File 01",
      "uploadData": {
          "isBase64Encoded": false,
          "headers": {
              "Access-Control-Allow-Origin": "*"
          },
          "uploadURL": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/da226bf2-4e5f-4180-94d8-6746b1ce139b.jpg?Content-Type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA37VN5NQI5HY4VFVN%2F20220617%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20220617T152621Z&X-Amz-Expires=900&X-Amz-Signature=4004cfb10a740b9623d486de992a06f53b458ed6fc151c092eea88a3059eae8f&X-Amz-SignedHeaders=host%3Bx-amz-acl&x-amz-acl=public-read",
          "photoFilename": "f7a32cd0-d0c1-474a-838e-47402d80527a.jpeg",
          "fileName": "1452664590074.jpeg",
          "uploadPath": "/survey_orders/f7a32cd0-d0c1-474a-838e-47402d80527a.jpeg",
          "resourceUrl": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/da226bf2-4e5f-4180-94d8-6746b1ce139b.jpg"
      }
    },
    {
      "id": 2,
      "s3Url": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql",
      "title": "File 02",
      "uploadData": {
          "isBase64Encoded": false,
          "headers": {
              "Access-Control-Allow-Origin": "*"
          },
          "uploadURL": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql?Content-Type=application%2Fsql&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA37VN5NQI5HY4VFVN%2F20220617%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20220617T152641Z&X-Amz-Expires=900&X-Amz-Signature=bcdf347df2a6495615bf48d619492e1deac2264231161da5dc3becaa7f45a796&X-Amz-SignedHeaders=host%3Bx-amz-acl&x-amz-acl=public-read",
          "photoFilename": "6c537889-c72a-48ca-9134-638e8d6a1aac.sql",
          "fileName": "eccom_bermuda.sql",
          "uploadPath": "/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql",
          "resourceUrl": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql"
      }
    },
    {
      "id": 3,
      "s3Url": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/house-rules-en/04f6a718-2b6b-4ce5-98a5-cf152e80c091.pdf",
      "title": "File 03",
      "uploadData": {
          "isBase64Encoded": false,
          "headers": {
              "Access-Control-Allow-Origin": "*"
          },
          "uploadURL": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/232f2548-dc93-4204-8835-86b69f3005a7.pdf?Content-Type=application%2Fpdf&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA37VN5NQI5HY4VFVN%2F20220617%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20220617T152656Z&X-Amz-Expires=900&X-Amz-Signature=85643479c3fbecc5bd1fee9783e3cb72e27e16a034921b52cf2f377eefb01ff9&X-Amz-SignedHeaders=host%3Bx-amz-acl&x-amz-acl=public-read",
          "photoFilename": "232f2548-dc93-4204-8835-86b69f3005a7.pdf",
          "fileName": "print-registration-4x6.pdf",
          "uploadPath": "/survey_orders/232f2548-dc93-4204-8835-86b69f3005a7.pdf",
          "resourceUrl": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/232f2548-dc93-4204-8835-86b69f3005a7.pdf"
      }
    }
  ];

  urlConfig: UrlConfig = {
    getUploadUrl: 'https://zoaca0s0ub.execute-api.ap-southeast-1.amazonaws.com/stage/image-new/get-upload-url',
    attachToEntity: 'https://zoaca0s0ub.execute-api.ap-southeast-1.amazonaws.com/stage/image-new/attach-to-entity',
    updateTag: 'https://zoaca0s0ub.execute-api.ap-southeast-1.amazonaws.com/stage/image-new/update-tag',
    updateSequence: 'https://zoaca0s0ub.execute-api.ap-southeast-1.amazonaws.com/stage/image-new/update-sequence',
    // attachToEntity: null,
    // updateTag: null,
    // updateSequence: null
    removeImage: 'https://zoaca0s0ub.execute-api.ap-southeast-1.amazonaws.com/stage/image-new/remove-url',
  };

  optionConfig: OptionConfig = {
    selectorId: 'choosing-image-for-image-details-card-view',
    height: '108px',
    limit: 10,
    fileSize: (1024 * 5), // for 5 MB;
    isCompressed: false,
    hiddenDeleteBtn: false,
    hiddenPreview: false,
    selectionMode: false,
    isMultiple: false,
    cols: 5,
    colsForTab: 5,
    colsForMobile: 3,
  }

  ngOnInit() {
  }

  getImagePickerDialogConfig(){
    let config: DialogConfig = {
      panelClass: 'tis-simple-confirmation',
      title: 'Delete Images',
      // message: 'Are you sure, you want to delete this image?',
      // iconClass: "tis-text-danger",
      // icon: "delete",
      // approveButtonText: 'Yes',
      // approveButtonClass: "tis-btn-danger",
      // cancelButtonText: 'No',
      // cancelButtonClass: "tis-btn-primary"
    }
    return config;
  }

  getOptions(config: any){
    let options: OptionConfig = {
      ...this.optionConfig,
      ...config
    }

    delete options.selectorId;

    return options;
  }

  onFileSelect(data: any){
    this.selectedId = data?.id;
    console.log("==== onFileSelect ====", data);
  }

  dataSequenceChange(data: any[]){
    console.log("==== dataSequenceChange ====", data);
  }
}