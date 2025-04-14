import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TisVideoComponent } from './tis-video.component';

describe('TisVideoComponent', () => {
  let component: TisVideoComponent;
  let fixture: ComponentFixture<TisVideoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TisVideoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TisVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
