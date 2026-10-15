import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { HomeStore } from './home.store';
import { createHomeServiceMocks, HomeServiceMocks, makeVideo, provideHomeServiceMocks } from './testing/home-testing';

describe('HomeStore', () => {
  let mocks: HomeServiceMocks;

  beforeEach(() => {
    mocks = createHomeServiceMocks();
    TestBed.configureTestingModule({
      providers: [HomeStore, ...provideHomeServiceMocks(mocks)]
    });
  });

  it('should be created', () => {
    expect(TestBed.inject(HomeStore)).toBeTruthy();
  });

  it('should load videos and config from the backend on creation', () => {
    const videos = [makeVideo('videos/a.mp4')];
    mocks.backend.videos$ = new Subject();
    mocks.backend.configData$ = new Subject();
    const store = TestBed.inject(HomeStore);

    expect(store.loading).toBeTrue();
    mocks.backend.videos$.next(videos);
    mocks.backend.configData$.next({ botId: 'b1', busyRow: 'x', playing: true, globalVideoOrder: ['videos/a.mp4'] });

    expect(store.videos).toEqual(videos);
    expect(store.loading).toBeFalse();
    expect(store.botId).toBe('b1');
    expect(store.busyRow).toBe('x');
    expect(store.playing).toBeTrue();
    expect(store.globalVideoOrder).toEqual(['videos/a.mp4']);
  });

  it('should initialize and load meetings and video lists', () => {
    const store = TestBed.inject(HomeStore);
    store.init();
    expect(store.meetings).toEqual([]);
    expect(store.videoLists).toEqual([]);
  });

  it('should calculate displayedVideos correctly for all list', () => {
    const store = TestBed.inject(HomeStore);
    store.videos = [
      { videoPath: 'v1', videoUrl: 'u1', duration: 10, thumbnailPath: '', thumbnailUrl: '' },
      { videoPath: 'v2', videoUrl: 'u2', duration: 10, thumbnailPath: '', thumbnailUrl: '' }
    ];
    store.globalVideoOrder = ['v2', 'v1'];
    store.activeListId.set('all');

    const displayed = store.displayedVideos;
    expect(displayed[0].videoPath).toBe('v2');
    expect(displayed[1].videoPath).toBe('v1');
  });

  it('should only show videos of the active list, in the list order', () => {
    const store = TestBed.inject(HomeStore);
    store.videos = [makeVideo('v1'), makeVideo('v2'), makeVideo('v3')];
    store.videoLists = [{ id: 'l1', name: 'Lista', videoPaths: ['v3', 'v1'] }];
    store.activeListId.set('l1');

    expect(store.displayedVideos.map(v => v.videoPath)).toEqual(['v3', 'v1']);
  });

  it('should upload multiple files via fileChangeListener', async () => {
    const store = TestBed.inject(HomeStore);

    const mockEvent = {
      target: {
        files: [
          new File([''], 'test1.mp4', { type: 'video/mp4' }),
          new File([''], 'test2.mp4', { type: 'video/mp4' })
        ],
        value: 'some/path'
      }
    };

    await store.fileChangeListener(mockEvent);

    expect(store.isUploading).toBeFalse();
    expect(mocks.backend.uploadVideo).toHaveBeenCalledTimes(2);
    expect(mockEvent.target.value).toBe('');
  });

  it('should persist selected meeting id to localStorage', () => {
    const store = TestBed.inject(HomeStore);
    spyOn(localStorage, 'setItem');

    store.selectMeeting('meeting-abc');

    expect(store.selectedMeetingId()).toBe('meeting-abc');
    expect(localStorage.setItem).toHaveBeenCalledWith('selectedMeetingId', 'meeting-abc');
  });

  it('should restore cached meeting id from localStorage when valid', () => {
    spyOn(localStorage, 'getItem').and.returnValue('meeting-xyz');

    const meeting1 = { id: 'meeting-xyz', title: 'Cached', url: 'https://zoom.us/1' };
    const meeting2 = { id: 'meeting-other', title: 'Other', url: 'https://zoom.us/2' };

    const meetingsSubject = new Subject<any[]>();
    mocks.meetings.meetings$ = meetingsSubject.asObservable();

    const store = TestBed.inject(HomeStore);
    store.init();

    meetingsSubject.next([meeting1, meeting2]);

    // Cached id is still valid — should NOT be overridden
    expect(store.selectedMeetingId()).toBe('meeting-xyz');
  });

  it('should fall back to first meeting when cached id is not found', () => {
    spyOn(localStorage, 'getItem').and.returnValue('stale-id');

    const meeting1 = { id: 'meeting-first', title: 'First', url: 'https://zoom.us/1' };
    const meeting2 = { id: 'meeting-second', title: 'Second', url: 'https://zoom.us/2' };

    const meetingsSubject = new Subject<any[]>();
    mocks.meetings.meetings$ = meetingsSubject.asObservable();

    spyOn(localStorage, 'setItem');

    const store = TestBed.inject(HomeStore);
    store.init();

    meetingsSubject.next([meeting1, meeting2]);

    // Stale cached id not in list → should fall back to first meeting
    expect(store.selectedMeetingId()).toBe('meeting-first');
    expect(localStorage.setItem).toHaveBeenCalledWith('selectedMeetingId', 'meeting-first');
  });

  it('should filter drive files based on driveSearchQuery', () => {
    const store = TestBed.inject(HomeStore);
    store.driveFiles = [
      { id: '1', name: '504 Himno 1', mimeType: 'video/mp4', size: 100 },
      { id: '2', name: '521 Himno 2', mimeType: 'video/mp4', size: 200 },
      { id: '3', name: 'Alabanza', mimeType: 'video/mp4', size: 300 }
    ];

    store.driveSearchQuery.set('504');
    expect(store.filteredDriveFiles.length).toBe(1);
    expect(store.filteredDriveFiles[0].name).toBe('504 Himno 1');

    store.driveSearchQuery.set('himno');
    expect(store.filteredDriveFiles.length).toBe(2);

    store.driveSearchQuery.set('');
    expect(store.filteredDriveFiles.length).toBe(3);
  });

  it('should toggle drive expansion and load files if not loaded', () => {
    const store = TestBed.inject(HomeStore);

    store.isDriveExpanded.set(false);
    store.toggleDrive();

    expect(store.isDriveExpanded()).toBeTrue();
    expect(mocks.backend.listDriveFiles).toHaveBeenCalled();

    store.toggleDrive();
    expect(store.isDriveExpanded()).toBeFalse();
  });

  it('should toggle the meetings panel', () => {
    const store = TestBed.inject(HomeStore);
    expect(store.isMeetingsCollapsed()).toBeFalse();
    store.toggleMeetings();
    expect(store.isMeetingsCollapsed()).toBeTrue();
  });

  it('should toggle video selection and expose it through selectedList', () => {
    const store = TestBed.inject(HomeStore);
    store.videos = [makeVideo('v1'), makeVideo('v2')];

    store.toggle('v2');
    expect(store.selectedList().map(v => v.videoPath)).toEqual(['v2']);

    store.toggle('v2');
    expect(store.selectedList()).toEqual([]);
  });

  it('should restore the original order when reorder is cancelled', async () => {
    const store = TestBed.inject(HomeStore);
    store.globalVideoOrder = ['v1', 'v2'];

    await store.toggleReorder(); // enter reorder mode
    expect(store.reorderMode).toBeTrue();

    store.globalVideoOrder = ['v2', 'v1'];
    store.cancelReorder();

    expect(store.reorderMode).toBeFalse();
    expect(store.globalVideoOrder).toEqual(['v1', 'v2']);
  });
});
