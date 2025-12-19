import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TisViewConnectionDialogComponent } from './tis-view-connection-dialog.component';

describe('TisViewConnectionDialogComponent', () => {
  let component: TisViewConnectionDialogComponent;
  let fixture: ComponentFixture<TisViewConnectionDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TisViewConnectionDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TisViewConnectionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
