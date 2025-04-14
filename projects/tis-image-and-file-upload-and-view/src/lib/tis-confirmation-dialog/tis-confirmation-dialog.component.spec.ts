import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TisConfirmationDialogComponent } from './tis-confirmation-dialog.component';

describe('TisConfirmationDialogComponent', () => {
  let component: TisConfirmationDialogComponent;
  let fixture: ComponentFixture<TisConfirmationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TisConfirmationDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TisConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
