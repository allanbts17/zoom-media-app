import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MeetingsPanelLayout } from './meetings-panel.layout';
import { HomeStore } from '../../pages/home/home.store';
import { createHomeServiceMocks, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('MeetingsPanelLayout', () => {
  let fixture: ComponentFixture<MeetingsPanelLayout>;
  let store: HomeStore;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingsPanelLayout],
      providers: [HomeStore, ...provideHomeServiceMocks(createHomeServiceMocks())]
    }).compileComponents();

    store = TestBed.inject(HomeStore);
    fixture = TestBed.createComponent(MeetingsPanelLayout);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const buttonByText = (text: string) =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement;

  it('should create using the shared HomeStore', () => {
    expect(fixture.componentInstance.store).toBe(store);
  });

  it('should collapse and expand the content when clicking the header', () => {
    expect(el.querySelector('select')).toBeTruthy();

    (el.querySelector('header') as HTMLElement).click();
    fixture.detectChanges();
    expect(store.isMeetingsCollapsed()).toBeTrue();
    expect(el.querySelector('select')).toBeNull();

    (el.querySelector('header') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('select')).toBeTruthy();
  });

  it('should list the meetings in the selector', () => {
    store.meetings = [
      { id: 'm1', title: 'Culto', url: 'https://zoom.us/j/1' },
      { id: 'm2', url: 'https://zoom.us/j/2' },
    ];
    fixture.detectChanges();
    const options = Array.from(el.querySelectorAll('select option')).map(o => o.textContent?.trim());
    expect(options).toEqual(['-- Selecciona --', 'Culto · https://zoom.us/j/1', 'https://zoom.us/j/2']);
  });

  it('should disable "Crear bot" until a meeting with url is selected', () => {
    expect(buttonByText('Crear bot y unir').disabled).toBeTrue();

    store.meetings = [{ id: 'm1', url: 'https://zoom.us/j/1' }];
    store.selectedMeetingId.set('m1');
    fixture.detectChanges();
    expect(buttonByText('Crear bot y unir').disabled).toBeFalse();
  });

  it('should show bot status and id when a bot exists', () => {
    store.botId = 'bot-42';
    fixture.detectChanges();
    expect(el.textContent).toContain('Bot listo ✅');
    expect(el.textContent).toContain('bot-42');
  });

  it('should delegate bot and meeting actions to the store', () => {
    const removeSpy = spyOn(store, 'removeBot').and.returnValue(Promise.resolve());
    const addSpy = spyOn(store, 'addMeeting').and.returnValue(Promise.resolve());

    buttonByText('Retirar bot').click();
    buttonByText('Añadir').click();

    expect(removeSpy).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalled();
  });

  it('should update the Drive search query and load Drive files when typing', () => {
    const loadSpy = spyOn(store, 'loadDriveFiles').and.returnValue(Promise.resolve());
    const input = el.querySelector('input[placeholder^="Buscar himno"]') as HTMLInputElement;

    input.value = '504';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(store.driveSearchQuery()).toBe('504');
    expect(loadSpy).toHaveBeenCalledWith(true);
  });

  it('should clear the Drive search query with the clear button', () => {
    store.driveSearchQuery.set('504');
    fixture.detectChanges();

    const clearBtn = el.querySelector('input[placeholder^="Buscar himno"] + button') as HTMLButtonElement;
    clearBtn.click();
    fixture.detectChanges();

    expect(store.driveSearchQuery()).toBe('');
  });

  it('should forward selected files to store.fileChangeListener', () => {
    const uploadSpy = spyOn(store, 'fileChangeListener').and.returnValue(Promise.resolve());
    const fileInput = el.querySelector('#fileInput') as HTMLInputElement;
    fileInput.dispatchEvent(new Event('change'));
    expect(uploadSpy).toHaveBeenCalled();
  });

  it('should show the upload progress bar while uploading', () => {
    expect(el.querySelector('.animate-loading-bar')).toBeNull();
    store.isUploading = true;
    fixture.detectChanges();
    expect(el.querySelector('.animate-loading-bar')).toBeTruthy();
  });
});
