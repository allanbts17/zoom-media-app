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
});
