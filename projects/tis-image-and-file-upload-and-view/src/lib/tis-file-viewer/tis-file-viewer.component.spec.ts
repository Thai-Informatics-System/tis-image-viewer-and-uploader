import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TisFileViewerComponent } from './tis-file-viewer.component';

describe('TisFileViewerComponent', () => {
  let component: TisFileViewerComponent;
  let fixture: ComponentFixture<TisFileViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TisFileViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TisFileViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
