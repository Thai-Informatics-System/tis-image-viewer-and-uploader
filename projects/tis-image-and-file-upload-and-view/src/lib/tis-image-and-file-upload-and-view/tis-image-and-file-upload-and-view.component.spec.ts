import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TisImageAndFileUploadAndViewComponent } from './tis-image-and-file-upload-and-view.component';

describe('TisImageAndFileUploadAndViewComponent', () => {
  let component: TisImageAndFileUploadAndViewComponent;
  let fixture: ComponentFixture<TisImageAndFileUploadAndViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TisImageAndFileUploadAndViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TisImageAndFileUploadAndViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
