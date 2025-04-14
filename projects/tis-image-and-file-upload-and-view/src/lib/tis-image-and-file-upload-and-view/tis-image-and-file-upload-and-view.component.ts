import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { TisFileViewerComponent } from '../tis-file-viewer/tis-file-viewer.component';
import type { DialogConfig, FileViewerDialogData, FileViewerFileType, UrlConfig } from '../interfaces';
import { TisPreviewImageComponent } from '../tis-preview-image/tis-preview-image.component';
import { BehaviorSubject, Observable, map, shareReplay } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { TisHelperService } from '../services/tis-helper.service';
import { TisConfirmationDialogComponent } from '../tis-confirmation-dialog/tis-confirmation-dialog.component';

@Component({
  selector: 'tis-image-and-file-upload-and-view',
  standalone: false,
  templateUrl: './tis-image-and-file-upload-and-view.component.html',
  styleUrl: './tis-image-and-file-upload-and-view.component.css'
})
export class TisImageAndFileUploadAndViewComponent {
  private changeSubject = new BehaviorSubject<boolean>(false);

  @Input({required: true}) urlConfig!: UrlConfig;
  @Input() entityType!: string;
  @Input() entityId: any;
  @Input() viewType: 'card' | 'list' = 'card';
  @Input() type: 'image' | 'file' = 'image';
  @Input() label: string | null = null;
  @Input() disabled: boolean = false;
  @Input() data: any;
  @Input() hint: string | null = null;
  @Input() accept: string = '';
  @Input() selectedId: any = null;
  @Input() options: any = null;
  @Input() required: boolean = false;
  @Input() previewOnly: boolean = false;
  @Input() previewInFlex: boolean = false;
  @Input() imageItemClass: string = '';
  @Input() isEnableDeleteConfirmation: boolean = true;
  @Input() deleteConfirmationMsg!: string;
  @Input() dialogConfig!: DialogConfig;
  @Output() uploadInProgress = new EventEmitter();
  @Output() onUploaded = new EventEmitter();
  @Output() onFileSelect = new EventEmitter<any>();
  @Output() onFileRemoved = new EventEmitter<any>();

  isMobile = false;
  isTab = false;

  isHandset$!: Observable<boolean>;
  isTab$!: Observable<boolean>;


  config: any = {
    isCompressed: false,
    hiddenDeleteBtn: false,
    hiddenPreview: false,
    selectionMode: false,
    isStoredDb: false,
    isMultiple: false,
    fileSize: null,
    limit: 10,
    cols: 5,
    colsForTab: 5,
    colsForMobile: 3,
    height: '130px',
    selectorId: 'choosing-img',
  };

  isSliderLoaded = true;

  filesArray: any[] = [
    // {
    //   "s3Url": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/da226bf2-4e5f-4180-94d8-6746b1ce139b.jpg",
    //   "uploadData": {
    //       "isBase64Encoded": false,
    //       "headers": {
    //           "Access-Control-Allow-Origin": "*"
    //       },
    //       "uploadURL": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/da226bf2-4e5f-4180-94d8-6746b1ce139b.jpg?Content-Type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA37VN5NQI5HY4VFVN%2F20220617%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20220617T152621Z&X-Amz-Expires=900&X-Amz-Signature=4004cfb10a740b9623d486de992a06f53b458ed6fc151c092eea88a3059eae8f&X-Amz-SignedHeaders=host%3Bx-amz-acl&x-amz-acl=public-read",
    //       "photoFilename": "f7a32cd0-d0c1-474a-838e-47402d80527a.jpeg",
    //       "fileName": "1452664590074.jpeg",
    //       "uploadPath": "/survey_orders/f7a32cd0-d0c1-474a-838e-47402d80527a.jpeg",
    //       "resourceUrl": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/da226bf2-4e5f-4180-94d8-6746b1ce139b.jpg"
    //   }
    // },
    // {
    //   "s3Url": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/31033a2a-5db6-450d-a541-58a94654dd0c.jpg",
    //   "uploadData": {
    //       "isBase64Encoded": false,
    //       "headers": {
    //           "Access-Control-Allow-Origin": "*"
    //       },
    //       "uploadURL": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql?Content-Type=application%2Fsql&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA37VN5NQI5HY4VFVN%2F20220617%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20220617T152641Z&X-Amz-Expires=900&X-Amz-Signature=bcdf347df2a6495615bf48d619492e1deac2264231161da5dc3becaa7f45a796&X-Amz-SignedHeaders=host%3Bx-amz-acl&x-amz-acl=public-read",
    //       "photoFilename": "6c537889-c72a-48ca-9134-638e8d6a1aac.sql",
    //       "fileName": "eccom_bermuda.sql",
    //       "uploadPath": "/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql",
    //       "resourceUrl": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/6c537889-c72a-48ca-9134-638e8d6a1aac.sql"
    //   }
    // },
    // {
    //   "s3Url": "https://obk-servicemind-uat-resources.s3.ap-southeast-1.amazonaws.com/parcel_create/b8424185-30c6-4f44-ba1e-ff616dfd6576.jpg",
    //   "uploadData": {
    //       "isBase64Encoded": false,
    //       "headers": {
    //           "Access-Control-Allow-Origin": "*"
    //       },
    //       "uploadURL": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/232f2548-dc93-4204-8835-86b69f3005a7.pdf?Content-Type=application%2Fpdf&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA37VN5NQI5HY4VFVN%2F20220617%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20220617T152656Z&X-Amz-Expires=900&X-Amz-Signature=85643479c3fbecc5bd1fee9783e3cb72e27e16a034921b52cf2f377eefb01ff9&X-Amz-SignedHeaders=host%3Bx-amz-acl&x-amz-acl=public-read",
    //       "photoFilename": "232f2548-dc93-4204-8835-86b69f3005a7.pdf",
    //       "fileName": "print-registration-4x6.pdf",
    //       "uploadPath": "/survey_orders/232f2548-dc93-4204-8835-86b69f3005a7.pdf",
    //       "resourceUrl": "https://servicemind-resources-staging.s3.ap-southeast-1.amazonaws.com/survey_orders/232f2548-dc93-4204-8835-86b69f3005a7.pdf"
    //   }
    // }
  ];
  currentEntityId!: number;
  currentEntityType!: string;
  images = [];
  loading = false;
  status = false;


  constructor(
    public dialog: MatDialog,
    private helper: TisHelperService,
    private breakpointObserver: BreakpointObserver
  ) { }

  ngOnInit() {
    this.isHandset$ = this.breakpointObserver.observe([Breakpoints.Handset])
      .pipe(
        map(result => result.matches),
        shareReplay()
      );

    this.isTab$ = this.breakpointObserver.observe([Breakpoints.TabletPortrait])
      .pipe(
        map(result => result.matches),
        shareReplay()
      );
    
    this.prepareConfig();
  }

  ngAfterViewInit() {
    this.isHandset$.subscribe(r => {
      console.log('IS HANDSET:', r);
      this.isMobile = r;
      this.changeSubject.next(true);
    });
    this.isTab$.subscribe(r => {
      console.log('IS TAB:', r);
      this.isTab = r;
      this.changeSubject.next(true);
    });

    this.changeSubject.subscribe(status => {
      let cols = 1;
      if (this.isMobile) {
        cols = this.options?.colsForMobile ?? 3;
      }
      else if (this.isTab) {
        cols = this.options?.colsForTab ?? 4;
      }
      else {
        cols = this.options?.cols ?? 5;
      }

      this.config.cols = cols;
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['entityId']) {
      this.currentEntityId = changes['entityId'].currentValue;
    }
    if (changes['entityType']) {
      this.currentEntityType = changes['entityType'].currentValue;
    }
    if (changes['options']) {
      this.prepareConfig();
    }
    if (changes['data']) {
      this.filesArray = changes['data']?.currentValue ?? [];
      this.filesArray = this.filesArray?.map(r => {
        r.loading = false;
        return r;
      });
      console.log("this.filesArray", this.filesArray);
    }
  }

  prepareConfig() {
    if (this.options?.isCompressed) {
      this.config.isCompressed = this.options?.isCompressed;
    }

    if (this.options?.isSliderPreview) {
      this.config.isSliderPreview = this.options?.isSliderPreview;
    }

    if (this.options?.hiddenDeleteBtn) {
      this.config.hiddenDeleteBtn = this.options?.hiddenDeleteBtn;
    }

    if (this.options?.hiddenPreview) {
      this.config.hiddenPreview = this.options?.hiddenPreview;
    }

    if (this.options?.selectionMode) {
      this.config.selectionMode = this.options?.selectionMode;
    }

    if (this.options?.isStoredDb) {
      this.config.isStoredDb = this.options?.isStoredDb;
    }

    if (this.options?.isMultiple) {
      this.config.isMultiple = this.options?.isMultiple;
    }

    if (this.options?.fileSize) {
      this.config.fileSize = this.options?.fileSize;
    }

    if (this.options?.limit) {
      this.config.limit = this.options?.limit;
    }

    if (this.options?.cols) {
      this.config.cols = this.options?.cols;
    }

    if (this.options?.colsForTab) {
      this.config.colsForTab = this.options?.colsForTab;
    }

    if (this.options?.colsForMobile) {
      this.config.colsForMobile = this.options?.colsForMobile;
    }

    if (this.options?.height) {
      this.config.height = this.options?.height;
    }

    if (this.options?.selectorId) {
      this.config.selectorId = this.options?.selectorId;
    }
  }

  setSliderLoading() {
    this.isSliderLoaded = false;
    setTimeout(() => {
      this.isSliderLoaded = true;
    }, 20);
  }

  openImageSelector() {
    document.getElementById(this.config?.selectorId)?.click();
  }

  async detectImages(event: any) {
    console.log('detectImages:', event);
    event.preventDefault();

    if (this.config?.limit === 1) {
      this.filesArray = []; // Reset array for a single image
    }

    let files = event.target.files;
    if (!files) {
      this.helper.showErrorMsg('Please select an image', 'Error', 3000);
      return;
    }

    if ((this.filesArray?.length + files.length) > this.config?.limit) {
      this.helper.showErrorMsg(`You can upload a maximum of ${this.config?.limit} images`, 'Error', 3000);
      return;
    }

    this.loading = true;
    this.uploadInProgress.emit(true);

    let uploadedImages: any[] = [];

    // Process all images concurrently and wait for completion
    await Promise.all([...files].map(file => this.processImage(file, uploadedImages)));

    if (this.config?.isStoredDb) {
      await this.uploadImages(uploadedImages);
    }

    this.loading = false;
    this.uploadInProgress.emit(false);

    this.onSubmit(); // Call once after all uploads
  }

  async processImage(file: File, uploadedImages: any[]) {
    let fileSize = file.size / 1024;
    if (this.config?.fileSize && fileSize > this.config?.fileSize) {
      let maxSize = this.config.fileSize / 1024;
      this.helper.showErrorMsg(`File size must be ≤ ${maxSize >= 1 ? maxSize : this.config.fileSize} ${maxSize >= 1 ? 'MB' : 'KB'}`, 'Error', 3000);
      return;
    }

    return new Promise<void>((resolve) => {
      let reader = new FileReader();
      reader.onload = async (e: any) => {
        let mimeType = file.type;
        let compressedImage = this.config?.isCompressed ? await this.helper.compressFile(e.target?.result, mimeType) : e.target.result;

        try {
          let uploadResponse = await this.helper.getUploadUrl(this.urlConfig.getUploadUrl, file.name, mimeType, this.currentEntityType).toPromise();
          let uploadData = uploadResponse.data.uploadUrlData;
          let dataUrl = await this.helper.getDataUrlFromFile(file);

          let currentImageData = {
            title: file.name, name: file.name, s3Url: dataUrl,
            filename: file.name, s3Path: uploadData.uploadPath,
            tempS3Url: uploadData.resourceUrl, id: null,
            uploadData: uploadData, loading: true
          };

          this.filesArray = [currentImageData, ...this.filesArray];
          this.setSliderLoading();
          uploadedImages.push(currentImageData);

          await this.helper.putFile(uploadData.uploadURL, compressedImage).toPromise();

          // Final processing
          currentImageData.s3Url = currentImageData.tempS3Url;
          currentImageData.loading = !this.config?.isStoredDb;
          this.setSliderLoading();

          resolve();
        } catch (error: any) {
          this.helper.showHttpErrorMsg(error);
          resolve();
        }
      };

      reader.readAsArrayBuffer(file);
    });
  }

  uploadImages(data: any) {
    return new Promise((resolve, reject) => {
      if (data && data?.length > 0) {
        console.log('There is a image pending to attach:', data);

        let images: any[] = [];
        let fa = data.map((r: any) => {
          if (r?.uploadData) {
            images.push({ fileName: r.uploadData?.fileName, resourceUrl: r.uploadData?.resourceUrl, uploadPath: r.uploadData?.uploadPath, uploadURL: r.uploadData?.uploadURL });
            // delete r.uploadData;
          }

          return r;

        });

        this.helper.attachFilesToEntity(this.urlConfig.attachToEntity, { images: images, entityId: this.currentEntityId, entityType: this.currentEntityType }).subscribe({
          next: (ir: any) => {
            resolve(ir);
          },
          error: (imErr: any) => this.helper.showErrorMsg(imErr, "Error")
        });

      } else {
        resolve(false);
      }
    });
  }


  deleteImage(event: any, t: any, index: number, img: any) {
    event.stopPropagation();
    if (this.isEnableDeleteConfirmation) {
      let confirmBoxData: DialogConfig = {
        title: this.dialogConfig.title,
        message: this.deleteConfirmationMsg ?? this.dialogConfig.message,
        iconClass: this.dialogConfig.iconClass,
        icon: this.dialogConfig.icon,
        approveButtonText: this.dialogConfig.approveButtonText,
        approveButtonClass: this.dialogConfig.approveButtonClass,
        cancelButtonText: this.dialogConfig.cancelButtonText,
        cancelButtonClass: this.dialogConfig.cancelButtonClass
      };

      const dialogRef = this.dialog.open(TisConfirmationDialogComponent, {
        width: "450px",
        panelClass: ['tis-confirmation-dialog'],
        data: confirmBoxData,
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((result: any) => {
        console.log("The dialog was closed with result:", result);
        if (result) {
          this.removeImage(event, index, img);
        }
      });
    }
    else {
      this.removeImage(event, index, img);
    }
  }


  /*REMOVE SELECTED IMAGE  */
  removeImage(event: any, index: number, img: any) {
    this.loading = true;
    this.filesArray[index].loading = true;
    if (img?.id) {
      delete img.uploadData;
      this.removeUploadedImage(img, index, true);
    }
    else {
      this.loading = false;
      this.filesArray.splice(index, 1);
      this.setSliderLoading();
      this.onSubmit();
    }
  }

  removeUploadedImage(img: any, index: number, silently: boolean = false) {
    console.log("removeUploadedImage:", img);
    this.helper.deleteUploadedFile(this.urlConfig.removeImage, img).subscribe((r: any) => {
      console.log('Image Delete Res:', r);
      this.loading = false;
      this.filesArray.splice(index, 1);
      this.setSliderLoading();
      this.onSubmit();
      if (!silently) {
        this.helper.showSuccessMsg(r.message, 'Success', 3000);
      }
    },
    (err: any) => { this.filesArray[index].loading = false; this.helper.showErrorMsg(err, "Error") })
  }

  async detectFiles(event: any) {
    console.log('detectFiles:', event);
    event.preventDefault();

    if (this.config?.limit === 1) {
      this.filesArray = []; // Reset array for a single file
    }

    let files = event.target.files;
    if (!files) {
      this.helper.showErrorMsg('Please select a file', 'Error', 3000);
      return;
    }

    if ((this.filesArray?.length + files.length) > this.config?.limit) {
      this.helper.showErrorMsg(`You can upload a maximum of ${this.config?.limit} files`, 'Error', 3000);
      return;
    }

    this.loading = true;
    this.uploadInProgress.emit(true);

    let uploadedFiles: any[] = [];

    // Process all files concurrently and wait for completion
    await Promise.all([...files].map(file => this.processFile(file, uploadedFiles)));

    if (this.config?.isStoredDb) {
      await this.uploadFiles(uploadedFiles);
    }

    this.loading = false;
    this.uploadInProgress.emit(false);

    this.onSubmit(); // Call once after all uploads
  }

  async processFile(file: File, uploadedFiles: any[]) {
    let fileSize = file.size / 1024;
    if (this.config?.fileSize && fileSize > this.config?.fileSize) {
      let maxSize = this.config.fileSize / 1024;
      this.helper.showErrorMsg(`File size must be ≤ ${maxSize >= 1 ? maxSize : this.config.fileSize} ${maxSize >= 1 ? 'MB' : 'KB'}`, 'Error', 3000);
      return;
    }

    return new Promise<void>((resolve) => {
      let reader = new FileReader();
      reader.onload = async (e: any) => {
        let mimeType = file.type;
        let buffer = new Uint8Array(<ArrayBuffer>reader.result);

        try {
          let uploadResponse = await this.helper.getUploadUrl(this.urlConfig.getUploadUrl, file.name, mimeType, this.currentEntityType).toPromise();
          let uploadData = uploadResponse.data.uploadUrlData;

          let currentFileData = {
            title: file.name, name: file.name, s3Url: uploadData.resourceUrl,
            s3Path: uploadData.uploadPath, filename: file.name, id: null,
            uploadData: uploadData, loading: true, buffer: buffer
          };

          this.filesArray = [currentFileData, ...this.filesArray];
          this.setSliderLoading();
          uploadedFiles.push(currentFileData);

          await this.helper.putFile(uploadData.uploadURL, e.target.result).toPromise();

          // Final processing
          currentFileData.s3Url = currentFileData.uploadData?.resourceUrl;
          currentFileData.loading = !this.config?.isStoredDb;
          this.setSliderLoading();

          resolve();
        } catch (error: any) {
          this.helper.showHttpErrorMsg(error);
          resolve();
        }
      };

      reader.readAsArrayBuffer(file);
    });
  }

  uploadFiles(data: any) {
    return new Promise((resolve, reject) => {
      if (data && data.length > 0) {
        console.log('There is a file pending to attach:', data);

        let files: any[] = [];
        let fa = data.map((r: any) => {
          if (r?.uploadData) {
            files.push({ fileName: r.uploadData?.fileName, resourceUrl: r.uploadData?.resourceUrl, uploadPath: r.uploadData?.uploadPath, uploadURL: r.uploadData?.uploadURL });
            // delete r.uploadData;
          }

          return r;

        });

        this.helper.attachFilesToEntity(this.urlConfig.attachToEntity, { files: files, entityId: this.currentEntityId, entityType: this.currentEntityType }).subscribe({
          next: (ir: any) => {
            // this.filesArray = fa;
            this.filesArray[0].loading = false;
            this.onSubmit();
            resolve(ir);
          },
          error: (imErr: any) => reject(imErr)
        });
      } else {
        resolve(false);
      }
    });
  }

  deleteFile(event: any, t: any, index: number, file: any) {
    event.stopPropagation();
    if (this.isEnableDeleteConfirmation) {
      let confirmBoxData: DialogConfig = {
        title: this.dialogConfig.title,
        message: this.deleteConfirmationMsg ?? this.dialogConfig.message,
        iconClass: this.dialogConfig.iconClass,
        icon: this.dialogConfig.icon,
        approveButtonText: this.dialogConfig.approveButtonText,
        approveButtonClass: this.dialogConfig.approveButtonClass,
        cancelButtonText: this.dialogConfig.cancelButtonText,
        cancelButtonClass: this.dialogConfig.cancelButtonClass
      };

      const dialogRef = this.dialog.open(TisConfirmationDialogComponent, {
        width: "450px",
        panelClass: ['tis-simple-confirmation'],
        data: confirmBoxData,
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((result: any) => {
        console.log("The dialog was closed with result:", result);
        if (result) {
          this.removeFile(event, index, file);
        }
      });
    }
    else {
      this.removeFile(event, index, file);
    }
  }

  removeFile(event: any, index: number, file: any) {
    this.loading = true;
    this.filesArray[index].loading = true;
    if (file?.id) {
      delete file.uploadData;
      this.removeUploadedFile(file, index, true);
    }
    else {
      this.loading = false;
      this.filesArray.splice(index, 1);
      this.setSliderLoading();
      this.onSubmit();
      this.onFileRemoved.emit(true);
    }
  }

  removeUploadedFile(file: any, index: number, silently = false) {
    console.log("removeUploadedFile:", file);
    this.helper.deleteUploadedFile(this.urlConfig.removeImage, file).subscribe((r: any) => {
      console.log('File Delete Res:', r);
      this.loading = false;
      this.filesArray.splice(index, 1);
      this.setSliderLoading();
      this.onSubmit();
      if (!silently) {
        this.helper.showSuccessMsg(r.message, 'Success', 3000);
      }
      this.onSubmit();
    },
    (err: any) => { this.filesArray[index].loading = false; this.helper.showErrorMsg(err, "Error") })
  }

  onSubmit() {
    this.onUploaded.emit(this.filesArray);
  }

  async downloadFile(url: string, fileName: string) {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const el = document.createElement("a");
        el.href = blobUrl;
        el.download = fileName;
        document.body.appendChild(el);
        el.click();
        document.body.removeChild(el);
        URL.revokeObjectURL(blobUrl); // Cleanup
      })
      .catch(error => console.error("Download failed", error));
  }

  clickTimeout: any = null;
  clickDelay: number = 250; // Delay in milliseconds to distinguish single and double click

  onSelectFile(file: any) {
    if (this.config.selectionMode) {
      if (this.clickTimeout) {
        clearTimeout(this.clickTimeout);
        this.clickTimeout = null;
        this.openFile(file); // Double-click detected
      } else {
        this.clickTimeout = setTimeout(() => {
          this.clickTimeout = null;
          if (this.config.selectionMode) {
            this.onFileSelect.emit(file); // Single-click detected
          }
        }, this.clickDelay);
      }
    }
    else {
      this.clickTimeout = null;
      this.openFile(file);
    }
  }

  openFile(file: any) {
    if (!this.config.hiddenPreview) {
      this.openPreviewDialog(file.s3Url, file.title);
    }
  }

  openPreviewDialog(url: string, title: string): void {
    if (url.indexOf('.jpg') != -1 || url.indexOf('.jpeg') != -1 || url.indexOf('.png') != -1) {
      this.openImagePreviewDialog(url);
    }
    else if (url.indexOf('.pdf') != -1) {
      this.openFileViewer(url, 'pdf');
    }
    // else if(url.indexOf('.csv') != -1){
    //   this.openFileViewer(url, 'csv');
    // }
    else if (url.indexOf('.xlxs') != -1 || url.indexOf('.xlx') != -1 || url.indexOf('.xls') != -1) {
      this.openFileViewer(url, 'excel');
    }
    else {
      this.downloadFile(url, title);
    }
  }

  openImagePreviewDialog(url: string): void {
    const dialogRef = this.dialog.open(TisPreviewImageComponent, {
      panelClass: ['mat-p-0', 'relative'],
      data: { url },
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      console.log('The dialog was closed', result);
    });
  }

  openFileViewer(pdfUrl: string, fileType: FileViewerFileType) {
    let dialogData: FileViewerDialogData = {
      src: pdfUrl,
      fileType: fileType
    };

    const dialogRef = this.dialog.open(TisFileViewerComponent, {
      width: this.isMobile ? "100%" : "90%",
      height: this.isMobile ? "100%" : "98%",
      minHeight: this.isMobile ? "100%" : "80%",
      maxWidth: this.isMobile ? "100%" : "100%",
      panelClass: ['tis-file-viewer'],
      data: dialogData,
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      console.log("FileViewer Dialog Closed");
    });
  }

  checkingForPreview(img: string) {
    let imageArray = img.split('.');
    let imageType = imageArray[imageArray?.length - 1];
    if (imageType == 'png' || imageType == 'jpg' || imageType == 'jpeg') {
      return true;
    }
    else {
      return false;
    }
  }

  setHeight(id: string) {
    let height = document.getElementById(id)?.offsetWidth;
    return `${height}px`;
  }
}
