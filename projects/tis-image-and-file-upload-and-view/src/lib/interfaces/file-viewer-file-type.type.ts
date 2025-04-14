export type FileViewerFileType = 'pdf' | 'excel' | 'csv' | 'image' | 'video' | 'raw';

export interface FileViewerDialogData {
    src: string;
    fileType: FileViewerFileType;
}

export interface UrlConfig {
    getUploadUrl: string;
    attachToEntity: string;
    removeImage: string;
}

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