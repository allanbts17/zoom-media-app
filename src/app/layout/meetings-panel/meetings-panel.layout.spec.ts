import { Subject } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MeetingsPanelLayout } from './meetings-panel.layout';
import { HomeStateService } from '../../pages/home/home-state.service';
import { createHomeServiceMocks, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('MeetingsPanelLayout', () => {
  let fixture: ComponentFixture<MeetingsPanelLayout>;
  let state: HomeStateService;
  let component: MeetingsPanelLayout;
  let mocks: ReturnType<typeof createHomeServiceMocks>;
  let el: HTMLElement;

  beforeEach(async () => {
    mocks = createHomeServiceMocks();
    await TestBed.configureTestingModule({
      imports: [MeetingsPanelLayout],
      providers: [HomeStateService, ...provideHomeServiceMocks(mocks)]
    }).compileComponents();

    state = TestBed.inject(HomeStateService);
    fixture = TestBed.createComponent(MeetingsPanelLayout);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const buttonByText = (text: string) =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement;

  it('should create using the shared HomeStateService', () => {
    expect(fixture.componentInstance.state).toBe(state);
  });

  it('should collapse and expand the content when clicking the header', () => {
    expect(el.querySelector('select')).toBeTruthy();

    (el.querySelector('header') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.isMeetingsCollapsed()).toBeTrue();
    expect(el.querySelector('select')).toBeNull();

    (el.querySelector('header') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('select')).toBeTruthy();
  });

  it('should list the meetings in the selector', () => {
    component.meetings = [
      { id: 'm1', title: 'Culto', url: 'https://zoom.us/j/1' },
      { id: 'm2', url: 'https://zoom.us/j/2' },
    ];
    fixture.detectChanges();
    const options = Array.from(el.querySelectorAll('select option')).map(o => o.textContent?.trim());
    expect(options).toEqual(['-- Selecciona --', 'Culto · https://zoom.us/j/1', 'https://zoom.us/j/2']);
  });

  it('should disable "Crear bot" until a meeting with url is selected', () => {
    expect(buttonByText('Crear bot y unir').disabled).toBeTrue();

    component.meetings = [{ id: 'm1', url: 'https://zoom.us/j/1' }];
    component.selectedMeetingId.set('m1');
    fixture.detectChanges();
    expect(buttonByText('Crear bot y unir').disabled).toBeFalse();
  });

  it('should show bot status and id when a bot exists', () => {
    state.botId = 'bot-42';
    fixture.detectChanges();
    expect(el.textContent).toContain('Bot listo ✅');
    expect(el.textContent).toContain('bot-42');
  });

  it('should handle bot and meeting actions in the layout', () => {
    const removeSpy = spyOn(component, 'removeBot').and.returnValue(Promise.resolve());
    const addSpy = spyOn(component, 'addMeeting').and.returnValue(Promise.resolve());

    buttonByText('Retirar bot').click();
    buttonByText('Añadir').click();

    expect(removeSpy).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalled();
  });

  it('should update the Drive search query and load Drive files when typing', () => {
    const loadSpy = spyOn(component, 'requestDrive').and.callThrough();
    const input = el.querySelector('input[placeholder^="Buscar himno"]') as HTMLInputElement;

    input.value = '504';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(state.driveSearchQuery()).toBe('504');
    expect(loadSpy).toHaveBeenCalled();
  });

  it('should clear the Drive search query with the clear button', () => {
    state.driveSearchQuery.set('504');
    fixture.detectChanges();

    const clearBtn = el.querySelector('input[placeholder^="Buscar himno"] + button') as HTMLButtonElement;
    clearBtn.click();
    fixture.detectChanges();

    expect(state.driveSearchQuery()).toBe('');
  });

  it('should forward selected files to component.fileChangeListener', () => {
    const uploadSpy = spyOn(component, 'fileChangeListener').and.returnValue(Promise.resolve());
    const fileInput = el.querySelector('#fileInput') as HTMLInputElement;
    fileInput.dispatchEvent(new Event('change'));
    expect(uploadSpy).toHaveBeenCalled();
  });

  it('should show the upload progress bar while uploading', () => {
    expect(el.querySelector('.animate-loading-bar')).toBeNull();
    component.isUploading = true;
    fixture.detectChanges();
    expect(el.querySelector('.animate-loading-bar')).toBeTruthy();
  });
  it('should upload multiple files via fileChangeListener', async () => {

    const mockEvent = {
      target: {
        files: [
          new File([''], 'test1.mp4', { type: 'video/mp4' }),
          new File([''], 'test2.mp4', { type: 'video/mp4' })
        ],
        value: 'some/path'
      }
    };

    await component.fileChangeListener(mockEvent);

    expect(component.isUploading).toBeFalse();
    expect(mocks.backend.uploadVideo).toHaveBeenCalledTimes(2);
    expect(mockEvent.target.value).toBe('');
  });

  it('should persist selected meeting id to localStorage', () => {
    spyOn(localStorage, 'setItem');

    component.selectMeeting('meeting-abc');

    expect(component.selectedMeetingId()).toBe('meeting-abc');
    expect(localStorage.setItem).toHaveBeenCalledWith('selectedMeetingId', 'meeting-abc');
  });

  it('should restore cached meeting id from localStorage when valid', () => {
    spyOn(localStorage, 'getItem').and.returnValue('meeting-xyz');

    const meeting1 = { id: 'meeting-xyz', title: 'Cached', url: 'https://zoom.us/1' };
    const meeting2 = { id: 'meeting-other', title: 'Other', url: 'https://zoom.us/2' };

    const meetingsSubject = new Subject<any[]>();
    mocks.meetings.meetings$ = meetingsSubject.asObservable();

    fixture.destroy();
    fixture = TestBed.createComponent(MeetingsPanelLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
    meetingsSubject.next([meeting1, meeting2]);

    // Cached id is still valid — should NOT be overridden
    expect(component.selectedMeetingId()).toBe('meeting-xyz');
  });

  it('should fall back to first meeting when cached id is not found', () => {
    spyOn(localStorage, 'getItem').and.returnValue('stale-id');

    const meeting1 = { id: 'meeting-first', title: 'First', url: 'https://zoom.us/1' };
    const meeting2 = { id: 'meeting-second', title: 'Second', url: 'https://zoom.us/2' };

    const meetingsSubject = new Subject<any[]>();
    mocks.meetings.meetings$ = meetingsSubject.asObservable();

    spyOn(localStorage, 'setItem');

    fixture.destroy();
    fixture = TestBed.createComponent(MeetingsPanelLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
    meetingsSubject.next([meeting1, meeting2]);

    // Stale cached id not in list → should fall back to first meeting
    expect(component.selectedMeetingId()).toBe('meeting-first');
    expect(localStorage.setItem).toHaveBeenCalledWith('selectedMeetingId', 'meeting-first');
  });
  it('should confirm the selected meeting name and delete its Firestore document', async () => {
    component.meetings = [{ id: 'm1', title: 'Culto', url: 'https://zoom.us/j/1' }];
    component.selectMeeting('m1');
    await component.deleteMeeting();
    expect(mocks.modal.confirm).toHaveBeenCalledWith('Eliminar reunión', '¿Deseas borrar la reunión “Culto”?');
    expect(mocks.meetings.deleteMeeting).toHaveBeenCalledOnceWith('m1');
    expect(component.isDeletingMeeting()).toBeFalse();
  });

  it('should leave the meeting intact when confirmation is cancelled', async () => {
    component.meetings = [{ id: 'm1', url: 'https://zoom.us/j/1' }];
    component.selectMeeting('m1');
    mocks.modal.confirm.and.resolveTo(false);
    await component.deleteMeeting();
    expect(mocks.modal.confirm).toHaveBeenCalledWith('Eliminar reunión', '¿Deseas borrar la reunión “https://zoom.us/j/1”?');
    expect(mocks.meetings.deleteMeeting).not.toHaveBeenCalled();
    expect(component.isDeletingMeeting()).toBeFalse();
  });

  it('should show deletion failures and allow retrying', async () => {
    component.meetings = [{ id: 'm1', url: 'https://zoom.us/j/1' }];
    component.selectMeeting('m1');
    mocks.meetings.deleteMeeting.and.rejectWith(new Error('No se pudo eliminar'));
    await component.deleteMeeting();
    expect(state.err).toBe('No se pudo eliminar');
    expect(component.isDeletingMeeting()).toBeFalse();
  });

  it('should disable deletion without a selected meeting', () => {
    component.selectedMeetingId.set('');
    fixture.detectChanges();
    expect(buttonByText('Eliminar reunión').disabled).toBeTrue();
  });

  it('should clear the cached selection when no meetings remain', () => {
    component.selectMeeting('m1');
    mocks.meetings.meetings$ = new Subject<any[]>();
    component.ngOnInit();
    mocks.meetings.meetings$.next([]);
    expect(component.selectedMeetingId()).toBe('');
    expect(localStorage.getItem('selectedMeetingId')).toBe('');
  });
});
