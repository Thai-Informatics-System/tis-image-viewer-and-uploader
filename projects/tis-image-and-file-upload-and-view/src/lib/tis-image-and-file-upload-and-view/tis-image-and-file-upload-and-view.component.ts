import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { TisFileViewerComponent } from '../tis-file-viewer/tis-file-viewer.component';
import type { DialogConfig, FileViewerDialogData, FileViewerFileType, OptionConfig, UrlConfig } from '../interfaces';
import { TisPreviewImageComponent } from '../tis-preview-image/tis-preview-image.component';
import { BehaviorSubject, Observable, map, sequenceEqual, shareReplay } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { TisHelperService } from '../services/tis-helper.service';
import { TisConfirmationDialogComponent } from '../tis-confirmation-dialog/tis-confirmation-dialog.component';
import { Config } from '../interfaces/config.type';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
  @Input() isValidateMimeType: boolean = true;
  @Input() selectedId: any = null;
  @Input() options: OptionConfig | null = null;
  @Input() required: boolean = false;
  @Input() previewOnly: boolean = false;
  @Input() previewInFlex: boolean = false;
  @Input() imageItemClass: string = '';
  @Input() isEnableDeleteConfirmation: boolean = true;
  @Input() isAddUploadedFileInLastNode: boolean = false;
  @Input() deleteConfirmationMsg!: string;
  @Input() dialogConfig!: DialogConfig;
  @Output() uploadInProgress = new EventEmitter();
  @Output() onUploaded = new EventEmitter();
  @Output() onFileSelect = new EventEmitter<any>();
  @Output() onFileRemoved = new EventEmitter<any>();
  @Output() onError = new EventEmitter();

  @Input() isShowImageSequence: boolean = false;
  @Input() enableDragNDrop: boolean = false;
  @Output() dataSequenceChange = new EventEmitter<any>();

  isMobile = false;
  isTab = false;

  isHandset$!: Observable<boolean>;
  isTab$!: Observable<boolean>;


  config: Config = {
    isCompressed: false,
    hiddenDeleteBtn: false,
    hiddenPreview: false,
    selectionMode: false,
    isStoredDb: false,
    isMultiple: false,
    limit: 10,
    cols: 5,
    colsForTab: 5,
    colsForMobile: 3,
    height: '130px',
    selectorId: generateRandomString(10),
    enableImageTags: false
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

    // if(this.viewType == 'single-card'){
    //   this.generateFilesForSingleCard();
    // }
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
    if (changes['urlConfig']) {
      this.urlConfig = changes['urlConfig'].currentValue;
      this.config.isStoredDb = false;
      if (this.urlConfig?.attachToEntity) {
        this.config.isStoredDb = true;
      }
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

    this.config.isStoredDb = false;
    if (this.urlConfig?.attachToEntity) {
      this.config.isStoredDb = true;
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

    if (this.options?.enableImageTags) {
      this.config.enableImageTags = this.options?.enableImageTags;
    }
  }

  /**
   * Validates selected files against the accept parameter
   * @param files - FileList of selected files
   * @returns boolean - true if all files are valid, false otherwise
   */
  private validateFileTypes(files: FileList): boolean {
    if (!this.accept || this.accept.trim() === '') {
      return true; // No validation needed if accept is not specified
    }

    const acceptedTypes = this.accept.split(',').map(type => type.trim().toLowerCase());
    const invalidFiles: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!acceptedTypes.includes(fileExtension)) {
        invalidFiles.push(file.name);
      }
    }
    
    if (invalidFiles.length > 0) {
      const acceptedTypesStr = acceptedTypes.join(', ');
      const invalidFilesStr = invalidFiles.join(', ');
      this.helper.showErrorMsg(
        `Invalid file type(s): ${invalidFilesStr}. Only ${acceptedTypesStr} files are allowed.`, 
        'Error', 
        5000
      );
      return false;
    }
    
    return true;
  }

  setSliderLoading() {
    this.isSliderLoaded = false;
    setTimeout(() => {
      this.isSliderLoaded = true;
    }, 20);
  }

  openImageSelector(selectorId: string = this.config?.selectorId) {
    document.getElementById(selectorId)?.click();
  }

  async detectImages(event: any, index: number = -1) {
    console.log('detectImages:', event);
    event.preventDefault();

    if (this.config?.limit === 1) {
      this.filesArray = []; // Reset array for a single image
    }

    const files = event.target.files;
    if (!files) {
      this.helper.showErrorMsg('Please select an image', 'Error', 3000);
      return;
    }

    // Validate file types based on accept parameter
    if (this.isValidateMimeType && !this.validateFileTypes(files)) {
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
    await Promise.all([...files].map(file => this.processImage(file, uploadedImages, index)));

    if (this.config?.isStoredDb) {
      await this.uploadImages(uploadedImages);
    }

    this.loading = false;
    this.uploadInProgress.emit(false);

    this.onSubmit(); // Call once after all uploads
    this.updateSequence();

    
    // Reset the input value so the same file can be selected again
    event.target.value = '';
  }

  async processImage(file: File, uploadedImages: any[], index: number) {
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
          
          // For initial display, use a data URL for preview but ensure S3 URL is used for database
          let dataUrl = await this.helper.getDataUrlFromFile(file);

          let currentImageData = {
            title: file.name, name: file.name, s3Url: dataUrl, // Temporary preview URL
            filename: file.name, s3Path: uploadData.uploadPath,
            tempS3Url: uploadData.resourceUrl, // This will be the final S3 URL
            id: null,
            uploadData: uploadData, loading: true,  // Set loading to true initially
            tags: null, tempTags: null, isEditMode: false, sequence: 1,
          };

          if(index == -1){
            if(this.isAddUploadedFileInLastNode){
              this.filesArray = [...this.filesArray, currentImageData];
            }
            else{
              this.filesArray = [currentImageData, ...this.filesArray];
            }
          }
          else{
            this.filesArray[index] = {...this.filesArray[index], ...currentImageData};
          }
          this.setSliderLoading();
          uploadedImages.push(currentImageData);

          // Upload to S3
          await this.helper.putFile(uploadData.uploadURL, compressedImage).toPromise();

          // After successful upload, update with S3 URL and mark as completed
          if(index == -1){
            const currentIndex = this.isAddUploadedFileInLastNode ? this.filesArray.length - 1 : 0;
            this.filesArray[currentIndex].s3Url = uploadData.resourceUrl; // Use S3 URL
            this.filesArray[currentIndex].loading = false;
            // Ensure uploadData contains the correct S3 URL for database storage
            this.filesArray[currentIndex].uploadData.resourceUrl = uploadData.resourceUrl;
          }
          else{
            this.filesArray[index].s3Url = uploadData.resourceUrl; // Use S3 URL
            this.filesArray[index].loading = false;
            // Ensure uploadData contains the correct S3 URL for database storage
            this.filesArray[index].uploadData.resourceUrl = uploadData.resourceUrl;
          }
          this.setSliderLoading();

          resolve();
        } catch (error: any) {
          // Set loading to false on error as well
          if(index == -1){
            const currentIndex = this.isAddUploadedFileInLastNode ? this.filesArray.length - 1 : 0;
            this.filesArray[currentIndex].loading = false;
          }
          else{
            this.filesArray[index].loading = false;
          }
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
            // Ensure we're using the S3 URL, not base64 data
            const s3Url = r.uploadData.resourceUrl;
            images.push({ 
              fileName: r.uploadData?.fileName, 
              resourceUrl: s3Url, // This ensures S3 URL is stored in database
              uploadPath: r.uploadData?.uploadPath, 
              uploadURL: r.uploadData?.uploadURL 
            });
          }
          return r;
        });

        this.helper.attachFilesToEntity(this.urlConfig?.attachToEntity || 'not-specified', { images: images, entityId: this.currentEntityId, entityType: this.currentEntityType }, this.config.limit).subscribe({
          next: (ir: any) => {
            ir?.data?.map((file: any) =>{
              // Match by S3 URL to update the correct file
              let selectedIndex = this.filesArray?.findIndex(f => f.uploadData?.resourceUrl == file.s3Url);
              if(selectedIndex !== -1){
                this.filesArray[selectedIndex] = {
                  ...this.filesArray[selectedIndex], 
                  loading: false, 
                  id: file?.id || null,
                  s3Url: file.s3Url // Ensure we're using the S3 URL from the response
                }
              }
            });
            this.onSubmit();
            resolve(ir);
          },
          error: (imErr: any) => { this.helper.showHttpErrorMsg(imErr); this.onError.emit(true); resolve(false); }
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
        title: this.dialogConfig?.title || 'Delete Image',
        message: this.deleteConfirmationMsg || (this.dialogConfig?.message || 'Are you sure, you want to delete this image?'),
        iconClass: this.dialogConfig?.iconClass || 'tis-text-danger',
        icon: this.dialogConfig?.icon || 'delete',
        approveButtonText: this.dialogConfig?.approveButtonText || 'Yes, delete',
        approveButtonClass: `tis-approve-button ${this.dialogConfig?.approveButtonClass}`,
        cancelButtonText: this.dialogConfig?.cancelButtonText || 'No',
        cancelButtonClass: `tis-cancel-button ${this.dialogConfig?.cancelButtonClass}`
      };

      const panelClass = ['tis-confirmation-dialog'];
      if(this.dialogConfig?.panelClass){
        panelClass.push(this.dialogConfig.panelClass);
      }

      const dialogRef = this.dialog.open(TisConfirmationDialogComponent, {
        width: "450px",
        panelClass: panelClass,
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

  async detectFiles(event: any, index: number = -1) {
    console.log('detectFiles:', event);
    event.preventDefault();

    if (this.config?.limit === 1) {
      this.filesArray = []; // Reset array for a single file
    }

    const files = event.target.files;
    if (!files) {
      this.helper.showErrorMsg('Please select a file', 'Error', 3000);
      return;
    }

    // Validate file types based on accept parameter
    if (this.isValidateMimeType && !this.validateFileTypes(files)) {
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
    await Promise.all([...files].map(file => this.processFile(file, uploadedFiles, index)));

    if (this.config?.isStoredDb) {
      await this.uploadFiles(uploadedFiles);
    }

    this.loading = false;
    this.uploadInProgress.emit(false);

    this.onSubmit(); // Call once after all uploads
    this.updateSequence();

    // Reset the input value so the same file can be selected again
    event.target.value = '';
  }

  async processFile(file: File, uploadedFiles: any[], index: number) {
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
            title: file.name, name: file.name, s3Url: uploadData.resourceUrl, // Use S3 URL
            s3Path: uploadData.uploadPath, filename: file.name, id: null,
            uploadData: uploadData, loading: true, buffer: buffer,  // Set loading to true initially
            tags: null, tempTags: null, isEditMode: false, sequence: 1,
          };

          if(index == -1){
            if(this.isAddUploadedFileInLastNode){
              this.filesArray = [...this.filesArray, currentFileData];
            }
            else{
              this.filesArray = [currentFileData, ...this.filesArray];
            }
          }
          else{
            this.filesArray[index] = {...this.filesArray[index], ...currentFileData};
          }
          this.setSliderLoading();
          uploadedFiles.push(currentFileData);

          // Upload to S3
          await this.helper.putFile(uploadData.uploadURL, e.target.result).toPromise();

          // After successful upload, ensure S3 URL is used and mark as completed
          if(index == -1){
            const currentIndex = this.isAddUploadedFileInLastNode ? this.filesArray.length - 1 : 0;
            this.filesArray[currentIndex].s3Url = uploadData.resourceUrl; // Ensure S3 URL
            this.filesArray[currentIndex].loading = false;
            // Ensure uploadData contains the correct S3 URL for database storage
            this.filesArray[currentIndex].uploadData.resourceUrl = uploadData.resourceUrl;
          }
          else{
            this.filesArray[index].s3Url = uploadData.resourceUrl; // Ensure S3 URL
            this.filesArray[index].loading = false;
            // Ensure uploadData contains the correct S3 URL for database storage
            this.filesArray[index].uploadData.resourceUrl = uploadData.resourceUrl;
          }
          this.setSliderLoading();

          resolve();
        } catch (error: any) {
          // Set loading to false on error as well
          if(index == -1){
            const currentIndex = this.isAddUploadedFileInLastNode ? this.filesArray.length - 1 : 0;
            this.filesArray[currentIndex].loading = false;
          }
          else{
            this.filesArray[index].loading = false;
          }
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
            // Ensure we're using the S3 URL, not any local file data
            const s3Url = r.uploadData.resourceUrl;
            files.push({ 
              fileName: r.uploadData?.fileName, 
              resourceUrl: s3Url, // This ensures S3 URL is stored in database
              uploadPath: r.uploadData?.uploadPath, 
              uploadURL: r.uploadData?.uploadURL 
            });
          }
          return r;
        });

        this.helper.attachFilesToEntity(this.urlConfig?.attachToEntity || 'not-specified', { files: files, entityId: this.currentEntityId, entityType: this.currentEntityType }, this.config.limit).subscribe({
          next: (ir: any) => {
            ir?.data?.map((file: any) =>{
              // Match by S3 URL to update the correct file
              let selectedIndex = this.filesArray?.findIndex(f => f.uploadData?.resourceUrl == file.s3Url);
              if(selectedIndex !== -1){
                this.filesArray[selectedIndex] = {
                  ...this.filesArray[selectedIndex], 
                  loading: false, 
                  id: file?.id || null,
                  s3Url: file.s3Url // Ensure we're using the S3 URL from the response
                }
              }
            });
            this.onSubmit();
            resolve(ir);
          },
          error: (imErr: any) => { this.helper.showHttpErrorMsg(imErr); this.onError.emit(true); resolve(false); }
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
        title: this.dialogConfig?.title || 'Delete File',
        message: this.deleteConfirmationMsg || (this.dialogConfig?.message || 'Are you sure, you want to delete this file?'),
        iconClass: this.dialogConfig?.iconClass || 'tis-text-danger',
        icon: this.dialogConfig?.icon || 'delete',
        approveButtonText: this.dialogConfig?.approveButtonText || 'Yes, delete',
        approveButtonClass: `tis-approve-button ${this.dialogConfig?.approveButtonClass}`,
        cancelButtonText: this.dialogConfig?.cancelButtonText || 'No',
        cancelButtonClass: `tis-cancel-button ${this.dialogConfig?.cancelButtonClass}`
      };

      const panelClass = ['tis-confirmation-dialog'];
      if(this.dialogConfig?.panelClass){
        panelClass.push(this.dialogConfig.panelClass);
      }

      const dialogRef = this.dialog.open(TisConfirmationDialogComponent, {
        width: "450px",
        panelClass: panelClass,
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
    this.filesArray = this.filesArray?.map((r, i) => { r.s3Url = r?.uploadData?.resourceUrl; return r; });
    this.onUploaded.emit(this.filesArray);
  }

  async downloadFile(url: string, fileName: string) {
    try {
      // First try with fetch
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      
      // Check if blob has content
      if (blob.size === 0) {
        throw new Error('File is empty or could not be fetched');
      }

      // Create download link
      const blobUrl = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = blobUrl;
      el.download = fileName;
      el.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
      
      // Cleanup blob URL
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 100);

    } catch (error) {
      console.error("Fetch download failed, trying alternative method:", error);
      
      // Fallback: Try direct link opening
      try {
        const el = document.createElement("a");
        el.href = url;
        el.download = fileName;
        el.target = '_blank';
        el.style.display = 'none';
        
        document.body.appendChild(el);
        el.click();
        document.body.removeChild(el);
        
      } catch (fallbackError) {
        console.error("All download methods failed:", fallbackError);
        this.helper.showErrorMsg("Failed to download file. Please try again or contact support.", 'Error', 5000);
      }
    }
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
    // console.log("=== setHeight::height ===", id, height);
    return `${height}px`;
  }

  generateFilesForSingleCard(){
    if(this.filesArray?.length < this.config.limit){
      for (let index = 0; index < (this.config.limit - this.filesArray?.length); index++) {
        this.filesArray.push({
          selectorId: generateRandomString(10),
          tags: null,
          tempTags: null,
          isEditMode: false
        });
      }
    }
    else{
      this.filesArray = this.filesArray?.map((file: any) => {
        return {...file, selectorId: generateRandomString(10), tempTag: null, isEditMode: false};
      });
    }
  }

  editTagWithSpace(file: any){
    console.log("=== editTagWithSpace :: file ===", file);
    
    let tempTag: any = file?.tempTags?.trim();
    console.log("=== editTagWithSpace :: tempTag ===", tempTag);

    if(tempTag && tempTag != ''){
      let tempTagsArr: any[] = tempTag?.split(' ');
      console.log("=== editTagWithSpace :: before tempTagsArr ===", tempTagsArr);

      tempTagsArr = tempTagsArr?.filter(e => (e && e != ''))?.map(t =>{
        if (t.includes('#')) {}
        else{
          t = `#${t}`;
        }
        return t;
      });

      tempTag = tempTagsArr.join(' ');
      file.tempTags = `${tempTag}`;
    }
    else{
      file.tempTags = tempTag
    }
  }

  onKeydown(event: KeyboardEvent, file: any) {
    if (event.key === ',' || event.keyCode === 188) {
      event.preventDefault();
      this.editTagWithComma(file);
    }
  }

  editTagWithComma(file: any){
    let tempTag: any = file?.tempTags?.trim();

    if(tempTag && tempTag != ''){
      let tempTagsArr: any[] = tempTag?.split(' ');
      tempTagsArr = tempTagsArr?.filter(e => (e && e != ''))?.map(t =>{
        if (t.includes('#')) {}
        else{
          t = `#${t}`;
        }
        return t;
      });

      tempTag = tempTagsArr.join(' ');
      tempTag = tempTag.replace(/,/g, '');
      file.tempTags = `${tempTag} `;
    }
    else{
      file.tempTags = tempTag
    }
  }

  onSubmitTags(file: any){
    file.tags = file?.tempTags?.trim();
    file.isEditMode = false;
    this.helper.updateTag(this.urlConfig?.updateTag || 'not-specified', {id: file?.id || null, tag: file?.tags || null}).subscribe({
      next: (ir: any) => {
        this.helper.showSuccessMsg(ir.message, 'Success', 3000);
        this.onSubmit();
      },
      error: (err: any) => this.helper.showHttpErrorMsg(err)
    });
  }

  drop(event: CdkDragDrop<any[]>) {
    // Ignore if the item was dropped at the same index
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    // Access current data from apiSubject
    const currentData = [...this.filesArray];

    if (!currentData || currentData.length === 0) {
      return;
    }

    // Rearrange items based on the drop event
    moveItemInArray(currentData, event.previousIndex, event.currentIndex);

    // Update the apiSubject with reordered data
    this.filesArray = currentData;

    this.updateSequence(true);
  }

  updateSequence(isShowMessage: boolean = false){
    this.filesArray = this.filesArray.map((file: any, index: number) => {
      return {...file, sequence: (index + 1)};
    }).filter(f => f?.id && f?.id != null && f?.id != '');

    if(this.enableDragNDrop && this.urlConfig?.updateSequence){
      let files: any[] = this.filesArray?.length ? JSON.parse(JSON.stringify(this.filesArray)) : [];
      files = files?.map(f =>{
        return {id: f?.id, sequence: f?.sequence || 1};
      });
      this.helper.updateSequence(this.urlConfig?.updateSequence || 'not-specified', {files}).subscribe({
        next: (ir: any) => {
          if(isShowMessage){
            this.helper.showSuccessMsg(ir.message, 'Success', 3000);
          }
          else{
            this.helper.showSuccessMsg(`${this.type == 'image' ? 'Image' : 'File'} has been uploaded successfully`, 'Success', 3000);
          }
          this.dataSequenceChange.emit(this.filesArray);
        },
        error: (err: any) => { this.helper.showHttpErrorMsg(err); this.onError.emit(true); }
      });
    }
    else{
      this.dataSequenceChange.emit(this.filesArray);
    }
  }

  getTagsArray(tags: string){
    let tempTag: any = tags?.trim();
    let tempTagsArr: any[] = tempTag?.split(' ');

    return tempTagsArr?.filter(e => e && e != '');
  }
}
