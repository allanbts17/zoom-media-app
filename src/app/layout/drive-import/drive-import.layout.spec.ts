import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DriveImportLayout } from './drive-import.layout';
import { HomeStateService } from '../../pages/home/home-state.service';
import { createHomeServiceMocks, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('DriveImportLayout', () => {
  let fixture: ComponentFixture<DriveImportLayout>;
  let state: HomeStateService;
  let component: DriveImportLayout;
  let mocks: ReturnType<typeof createHomeServiceMocks>;
  let el: HTMLElement;

  const files = [
    { id: 'f1', name: '504 Himno', mimeType: 'video/mp4', size: 2 * 1024 * 1024 },
    { id: 'f2', name: 'Alabanza', mimeType: 'video/quicktime', size: 512 },
  ];

  beforeEach(async () => {
    mocks = createHomeServiceMocks();
    await TestBed.configureTestingModule({
      imports: [DriveImportLayout],
      providers: [HomeStateService, ...provideHomeServiceMocks(mocks)]
    }).compileComponents();

    state = TestBed.inject(HomeStateService);
    fixture = TestBed.createComponent(DriveImportLayout);
    component = fixture.componentInstance;
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
    const toggleSpy = spyOn(component, 'toggleDrive').and.callThrough();
    (el.querySelector('header') as HTMLElement).click();
    fixture.detectChanges();

    expect(toggleSpy).toHaveBeenCalled();
    expect(body().classList).not.toContain('hidden');
  });

  it('should reload files with "Actualizar" without toggling the panel', () => {
    const toggleSpy = spyOn(component, 'toggleDrive');
    const loadSpy = spyOn(component, 'loadDriveFiles').and.returnValue(Promise.resolve());
    const refreshBtn = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Actualizar'))!;

    refreshBtn.click();

    expect(loadSpy).toHaveBeenCalledWith(true);
    expect(toggleSpy).not.toHaveBeenCalled();
  });

  it('should render the (filtered) drive files', () => {
    component.isDriveExpanded.set(true);
    component.driveFiles = files;
    fixture.detectChanges();
    expect(fileRows().length).toBe(2);
    expect(fileRows()[0].textContent).toContain('504 Himno');
    expect(fileRows()[0].textContent).toContain('2.0 MB');
    expect(fileRows()[1].textContent).toContain('quicktime');

    state.driveSearchQuery.set('504');
    fixture.detectChanges();
    expect(fileRows().length).toBe(1);
    expect(el.querySelector('header')?.textContent).toContain('Filtrado: "504"');
  });

  it('should import a file and disable the buttons while importing', () => {
    component.isDriveExpanded.set(true);
    component.driveFiles = files;
    fixture.detectChanges();

    const importSpy = spyOn(component, 'importDriveFile').and.returnValue(Promise.resolve());
    (el.querySelector('#import-drive-file-f1') as HTMLButtonElement).click();
    expect(importSpy).toHaveBeenCalledWith(files[0]);

    component.driveImportingId = 'f1';
    fixture.detectChanges();
    expect((el.querySelector('#import-drive-file-f1') as HTMLButtonElement).textContent).toContain('Importando...');
    expect((el.querySelector('#import-drive-file-f2') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('should show the error message', () => {
    component.driveError = 'Sin permisos';
    fixture.detectChanges();
    expect(el.textContent).toContain('Sin permisos');
  });

  it('should show the empty state depending on the search query', () => {
    component.isDriveExpanded.set(true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Haz clic en "Actualizar"');

    state.driveSearchQuery.set('999');
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
  it('should filter drive files based on driveSearchQuery', () => {
    component.driveFiles = [
      { id: '1', name: '504 Himno 1', mimeType: 'video/mp4', size: 100 },
      { id: '2', name: '521 Himno 2', mimeType: 'video/mp4', size: 200 },
      { id: '3', name: 'Alabanza', mimeType: 'video/mp4', size: 300 }
    ];

    state.driveSearchQuery.set('504');
    expect(component.filteredDriveFiles.length).toBe(1);
    expect(component.filteredDriveFiles[0].name).toBe('504 Himno 1');

    state.driveSearchQuery.set('himno');
    expect(component.filteredDriveFiles.length).toBe(2);

    state.driveSearchQuery.set('');
    expect(component.filteredDriveFiles.length).toBe(3);
  });

  it('should toggle drive expansion and load files if not loaded', () => {

    component.isDriveExpanded.set(false);
    component.toggleDrive();

    expect(component.isDriveExpanded()).toBeTrue();
    expect(mocks.backend.listDriveFiles).toHaveBeenCalled();

    component.toggleDrive();
    expect(component.isDriveExpanded()).toBeFalse();
  });
});
