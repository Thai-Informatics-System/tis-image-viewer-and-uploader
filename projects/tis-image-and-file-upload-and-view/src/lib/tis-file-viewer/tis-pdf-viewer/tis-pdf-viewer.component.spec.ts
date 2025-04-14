import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TisPdfViewerComponent } from './tis-pdf-viewer.component';

describe('TisPdfViewerComponent', () => {
  let component: TisPdfViewerComponent;
  let fixture: ComponentFixture<TisPdfViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TisPdfViewerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TisPdfViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
