import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TisPreviewImageComponent } from './tis-preview-image.component';

describe('TisPreviewImageComponent', () => {
  let component: TisPreviewImageComponent;
  let fixture: ComponentFixture<TisPreviewImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TisPreviewImageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TisPreviewImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
