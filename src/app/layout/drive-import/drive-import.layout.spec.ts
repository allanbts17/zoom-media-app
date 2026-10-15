import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DriveImportLayout } from './drive-import.layout';
import { HomeStore } from '../../pages/home/home.store';
import { createHomeServiceMocks, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('DriveImportLayout', () => {
  let fixture: ComponentFixture<DriveImportLayout>;
  let store: HomeStore;
  let el: HTMLElement;

  const files = [
    { id: 'f1', name: '504 Himno', mimeType: 'video/mp4', size: 2 * 1024 * 1024 },
    { id: 'f2', name: 'Alabanza', mimeType: 'video/quicktime', size: 512 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriveImportLayout],
      providers: [HomeStore, ...provideHomeServiceMocks(createHomeServiceMocks())]
    }).compileComponents();

    store = TestBed.inject(HomeStore);
    fixture = TestBed.createComponent(DriveImportLayout);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const body = () => el.querySelector('section > div') as HTMLElement;
  const fileRows = () => Array.from(el.querySelectorAll('tbody tr')) as HTMLTableRowElement[];

  it('should create collapsed', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(body().classList).toContain('hidden');
  });

  it('should toggle the panel when clicking the header', () => {
    const toggleSpy = spyOn(store, 'toggleDrive').and.callThrough();
    (el.querySelector('header') as HTMLElement).click();
    fixture.detectChanges();

    expect(toggleSpy).toHaveBeenCalled();
    expect(body().classList).not.toContain('hidden');
  });

  it('should reload files with "Actualizar" without toggling the panel', () => {
    const toggleSpy = spyOn(store, 'toggleDrive');
    const loadSpy = spyOn(store, 'loadDriveFiles').and.returnValue(Promise.resolve());
    const refreshBtn = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Actualizar'))!;

    refreshBtn.click();

    expect(loadSpy).toHaveBeenCalledWith(true);
    expect(toggleSpy).not.toHaveBeenCalled();
  });

  it('should render the (filtered) drive files', () => {
    store.isDriveExpanded.set(true);
    store.driveFiles = files;
    fixture.detectChanges();
    expect(fileRows().length).toBe(2);
    expect(fileRows()[0].textContent).toContain('504 Himno');
    expect(fileRows()[0].textContent).toContain('2.0 MB');
    expect(fileRows()[1].textContent).toContain('quicktime');

    store.driveSearchQuery.set('504');
    fixture.detectChanges();
    expect(fileRows().length).toBe(1);
    expect(el.querySelector('header')?.textContent).toContain('Filtrado: "504"');
  });

  it('should import a file and disable the buttons while importing', () => {
    store.isDriveExpanded.set(true);
    store.driveFiles = files;
    fixture.detectChanges();

    const importSpy = spyOn(store, 'importDriveFile').and.returnValue(Promise.resolve());
    (el.querySelector('#import-drive-file-f1') as HTMLButtonElement).click();
    expect(importSpy).toHaveBeenCalledWith(files[0]);

    store.driveImportingId = 'f1';
    fixture.detectChanges();
    expect((el.querySelector('#import-drive-file-f1') as HTMLButtonElement).textContent).toContain('Importando...');
    expect((el.querySelector('#import-drive-file-f2') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('should show the error message', () => {
    store.driveError = 'Sin permisos';
    fixture.detectChanges();
    expect(el.textContent).toContain('Sin permisos');
  });

  it('should show the empty state depending on the search query', () => {
    store.isDriveExpanded.set(true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Haz clic en "Actualizar"');

    store.driveSearchQuery.set('999');
    fixture.detectChanges();
    expect(el.textContent).toContain('No se encontraron himnos que coincidan con "999"');
  });

  it('formatBytes should format sizes', () => {
    const c = fixture.componentInstance;
    expect(c.formatBytes(undefined)).toBe('—');
    expect(c.formatBytes(0)).toBe('—');
    expect(c.formatBytes(2048)).toBe('2.0 KB');
    expect(c.formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(c.formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 GB');
  });
});
