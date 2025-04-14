import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TisExcelFileViewerComponent } from './tis-excel-file-viewer.component';

describe('TisExcelFileViewerComponent', () => {
  let component: TisExcelFileViewerComponent;
  let fixture: ComponentFixture<TisExcelFileViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TisExcelFileViewerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TisExcelFileViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
