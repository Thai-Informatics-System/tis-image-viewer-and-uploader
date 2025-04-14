import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TisErrorDialogComponent } from './tis-error-dialog.component';

describe('TisErrorDialogComponent', () => {
  let component: TisErrorDialogComponent;
  let fixture: ComponentFixture<TisErrorDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TisErrorDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TisErrorDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
