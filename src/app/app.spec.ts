import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Firestore } from '@angular/fire/firestore';
import { BackendService } from './shared/services/backend.service';
import { MeetingsService } from './shared/services/meetings.service';
import { ZoomService } from './shared/services/zoom.service';
import { VideoListsService } from './shared/services/video-lists.service';
import { ModalService } from './shared/services/modal.service';
import { LoadingService } from './shared/services/loading.service';
import { of } from 'rxjs';

describe('App', () => {
  let backendMock: any;
  let meetingsMock: any;
  let videoListsMock: any;
  let zoomMock: any;
  let modalMock: any;
  let loadingMock: any;

  beforeEach(async () => {
    backendMock = {
      videos$: of([]),
      configData$: of({ botId: '', busyRow: '', playing: false, globalVideoOrder: [] }),
      setConfig: jasmine.createSpy('setConfig').and.returnValue(Promise.resolve()),
      createBot: jasmine.createSpy('createBot').and.returnValue(of({ id: 'bot123' })),
      outputMedia: jasmine.createSpy('outputMedia').and.returnValue(of({})),
      stopMedia: jasmine.createSpy('stopMedia').and.returnValue(of({}))
    };
    meetingsMock = {
      meetings$: of([]),
      addMeeting: jasmine.createSpy('addMeeting').and.returnValue(Promise.resolve())
    };
    videoListsMock = {
      lists$: of([]),
      addList: jasmine.createSpy('addList').and.returnValue(Promise.resolve()),
      updateList: jasmine.createSpy('updateList').and.returnValue(Promise.resolve())
    };
    zoomMock = {
      shareApp: jasmine.createSpy('shareApp').and.returnValue(Promise.resolve())
    };
    modalMock = {
      confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve(true))
    };
    loadingMock = {
      show: jasmine.createSpy('show'),
      hide: jasmine.createSpy('hide')
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Firestore, useValue: {} },
        { provide: BackendService, useValue: backendMock },
        { provide: MeetingsService, useValue: meetingsMock },
        { provide: VideoListsService, useValue: videoListsMock },
        { provide: ZoomService, useValue: zoomMock },
        { provide: ModalService, useValue: modalMock },
        { provide: LoadingService, useValue: loadingMock }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should initialize and load meetings and video lists', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges(); // calls ngOnInit
    expect(app.meetings).toEqual([]);
    expect(app.videoLists).toEqual([]);
  });

  it('should calculate displayedVideos correctly for all list', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.videos = [
      { videoPath: 'v1', videoUrl: 'u1', duration: 10, thumbnailPath: '', thumbnailUrl: '' },
      { videoPath: 'v2', videoUrl: 'u2', duration: 10, thumbnailPath: '', thumbnailUrl: '' }
    ];
    app.globalVideoOrder = ['v2', 'v1'];
    app.activeListId.set('all');
    
    const displayed = app.displayedVideos;
    expect(displayed[0].videoPath).toBe('v2');
    expect(displayed[1].videoPath).toBe('v1');
  });

  it('should upload multiple files via fileChangeListener', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    backendMock.uploadVideo = jasmine.createSpy('uploadVideo').and.returnValue(Promise.resolve());

    const mockEvent = {
      target: {
        files: [
          new File([''], 'test1.mp4', { type: 'video/mp4' }),
          new File([''], 'test2.mp4', { type: 'video/mp4' })
        ],
        value: 'some/path'
      }
    };

    await app.fileChangeListener(mockEvent);

    expect(app.isUploading).toBeFalse();
    expect(backendMock.uploadVideo).toHaveBeenCalledTimes(2);
    expect(mockEvent.target.value).toBe('');
  });

  it('should persist selected meeting id to localStorage', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    spyOn(localStorage, 'setItem');

    app.selectMeeting('meeting-abc');

    expect(app.selectedMeetingId()).toBe('meeting-abc');
    expect(localStorage.setItem).toHaveBeenCalledWith('selectedMeetingId', 'meeting-abc');
  });

  it('should restore cached meeting id from localStorage when valid', async () => {
    spyOn(localStorage, 'getItem').and.returnValue('meeting-xyz');

    const meeting1 = { id: 'meeting-xyz', title: 'Cached', url: 'https://zoom.us/1' };
    const meeting2 = { id: 'meeting-other', title: 'Other', url: 'https://zoom.us/2' };

    const { Subject } = await import('rxjs');
    const meetingsSubject = new Subject<any[]>();
    meetingsMock.meetings$ = meetingsSubject.asObservable();

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit

    meetingsSubject.next([meeting1, meeting2]);

    // Cached id is still valid — should NOT be overridden
    expect(app.selectedMeetingId()).toBe('meeting-xyz');
  });

  it('should fall back to first meeting when cached id is not found', async () => {
    spyOn(localStorage, 'getItem').and.returnValue('stale-id');

    const meeting1 = { id: 'meeting-first', title: 'First', url: 'https://zoom.us/1' };
    const meeting2 = { id: 'meeting-second', title: 'Second', url: 'https://zoom.us/2' };

    const { Subject } = await import('rxjs');
    const meetingsSubject = new Subject<any[]>();
    meetingsMock.meetings$ = meetingsSubject.asObservable();

    spyOn(localStorage, 'setItem');

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit

    meetingsSubject.next([meeting1, meeting2]);

    // Stale cached id not in list → should fall back to first meeting
    expect(app.selectedMeetingId()).toBe('meeting-first');
    expect(localStorage.setItem).toHaveBeenCalledWith('selectedMeetingId', 'meeting-first');
  });

  it('should filter drive files based on driveSearchQuery', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.driveFiles = [
      { id: '1', name: '504 Himno 1', mimeType: 'video/mp4', size: 100 },
      { id: '2', name: '521 Himno 2', mimeType: 'video/mp4', size: 200 },
      { id: '3', name: 'Alabanza', mimeType: 'video/mp4', size: 300 }
    ];
    
    app.driveSearchQuery.set('504');
    expect(app.filteredDriveFiles.length).toBe(1);
    expect(app.filteredDriveFiles[0].name).toBe('504 Himno 1');

    app.driveSearchQuery.set('himno');
    expect(app.filteredDriveFiles.length).toBe(2);

    app.driveSearchQuery.set('');
    expect(app.filteredDriveFiles.length).toBe(3);
  });

  it('should toggle drive expansion and load files if not loaded', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    backendMock.listDriveFiles = jasmine.createSpy('listDriveFiles').and.returnValue(of({ files: [] }));
    
    app.isDriveExpanded.set(false);
    app.toggleDrive();
    
    expect(app.isDriveExpanded()).toBeTrue();
    expect(backendMock.listDriveFiles).toHaveBeenCalled();
    
    app.toggleDrive();
    expect(app.isDriveExpanded()).toBeFalse();
  });
});
