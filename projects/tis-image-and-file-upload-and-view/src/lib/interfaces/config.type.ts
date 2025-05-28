export interface Config {
    selectorId: string;
    height: string;
    limit: number;
    fileSize?: number;
    isCompressed?: boolean;
    isStoredDb?: boolean;
    isSliderPreview?: boolean;
    hiddenDownloadBtn?: boolean;
    hiddenDeleteBtn?: boolean;
    hiddenPreview?: boolean;
    isMultiple?: boolean;
    selectionMode?: boolean;
    cols: number;
    colsForTab: number;
    colsForMobile: number;
    enableImageTags?: boolean;
}