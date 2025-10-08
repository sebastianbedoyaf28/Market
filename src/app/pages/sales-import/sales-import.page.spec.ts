import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SalesImportPage } from './sales-import.page';

describe('SalesImportPage', () => {
  let component: SalesImportPage;
  let fixture: ComponentFixture<SalesImportPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SalesImportPage],
    });
    fixture = TestBed.createComponent(SalesImportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});