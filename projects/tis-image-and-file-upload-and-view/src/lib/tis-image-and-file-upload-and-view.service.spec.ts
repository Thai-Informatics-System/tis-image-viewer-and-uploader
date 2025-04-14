import { TestBed } from '@angular/core/testing';

import { TisImageAndFileUploadAndViewService } from './tis-image-and-file-upload-and-view.service';

describe('TisImageAndFileUploadAndViewService', () => {
  let service: TisImageAndFileUploadAndViewService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TisImageAndFileUploadAndViewService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
