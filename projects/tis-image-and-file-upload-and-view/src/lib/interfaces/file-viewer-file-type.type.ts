export type FileViewerFileType = 'pdf' | 'excel' | 'csv' | 'image' | 'video' | 'raw';

export interface FileViewerDialogData {
    src: string;
    fileType: FileViewerFileType;
}

export interface OptionConfig {
    selectorId?: string;
    limit?: number;
    fileSize?: number;
    height?: string;
    isCompressed?: boolean;
    isSliderPreview?: boolean;
    hiddenDownloadBtn?: boolean;
    hiddenDeleteBtn?: boolean;
    hiddenPreview?: boolean;
    isMultiple?: boolean;
    selectionMode?: boolean;
    cols?: number;
    colsForTab?: number;
    colsForMobile?: number;
    enableImageTags?: boolean;
    useAdvancedCamera?: boolean;
}

export interface UrlConfig {
    getUploadUrl: string;
    attachToEntity: string | null;
    updateTag: string | null;
    updateSequence: string | null;
    removeImage: string;
}

export interface DialogConfig {
    panelClass?: string | null;
    title?: string | null;
    message?: string | null;
    iconClass?: string | null;
    icon?: string | null;
    approveButtonText?: string | null;
    approveButtonClass?: string | null;
    cancelButtonText?: string | null;
    cancelButtonClass?: string | null;
}