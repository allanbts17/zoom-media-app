import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { DriveImportLayout } from '../../layout/drive-import/drive-import.layout';
import { MeetingsPanelLayout } from '../../layout/meetings-panel/meetings-panel.layout';
import { VideosTableLayout } from '../../layout/videos-table/videos-table.layout';
import { SelectionBarLayout } from '../../layout/selection-bar/selection-bar.layout';
import { GlobalActionsLayout } from '../../layout/global-actions/global-actions.layout';
import { makeVideo } from './testing/home-testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomePage } from './home.page';
import { HomeStateService } from './home-state.service';
import { createHomeServiceMocks, HomeServiceMocks, provideHomeServiceMocks } from './testing/home-testing';

describe('HomePage', () => {
  let mocks: HomeServiceMocks;
  let fixture: ComponentFixture<HomePage>;
  let el: HTMLElement;

  beforeEach(async () => {
    mocks = createHomeServiceMocks();
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([]), ...provideHomeServiceMocks(mocks)]
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    el = fixture.nativeElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should provide its own HomeStateService instance', () => {
    const pageState = fixture.debugElement.injector.get(HomeStateService);
    expect(pageState).toBe(fixture.componentInstance.state);
  });

  it('should render the title and all layout sections in order', () => {
    fixture.detectChanges();
    expect(el.querySelector('h1')?.textContent).toContain('Zoom Media Controller');

    const tags = Array.from(el.querySelectorAll('main > *')).map(n => n.tagName.toLowerCase());
    const layouts = tags.filter(t => t.startsWith('app-'));
    expect(layouts).toEqual([
      'app-meetings-panel',
      'app-global-actions',
      'app-selection-bar',
      'app-videos-table',
      'app-drive-import',
    ]);
  });

  it('should render the title with variable width and ellipsis while keeping user menu non-shrinkable', () => {
    fixture.detectChanges();
    const h1 = el.querySelector('header h1');
    const userMenu = el.querySelector('header app-user-menu');

    expect(h1).toBeTruthy();
    expect(h1?.classList.contains('min-w-0')).toBeTrue();
    expect(h1?.classList.contains('flex-1')).toBeTrue();
    expect(h1?.classList.contains('truncate')).toBeTrue();
    expect(userMenu?.classList.contains('shrink-0')).toBeTrue();
  });

  it('should show the error banner only when state.err is set', () => {
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Algo falló');

    fixture.componentInstance.state.err = 'Algo falló';
    fixture.detectChanges();
    expect(el.textContent).toContain('Algo falló');
  });

  it('should share the same state between the page and its layouts', () => {
    fixture.detectChanges();
    const state = fixture.componentInstance.state;
    state.botId = 'bot-shared';
    fixture.detectChanges();
    // Rendered by MeetingsPanelLayout
    expect(el.querySelector('app-meetings-panel')?.textContent).toContain('bot-shared');
  });

  it('loads common data in home and unsubscribes when the page is destroyed', () => {
    const videos = new Subject<any[]>();
    const config = new Subject<any>();
    const lists = new Subject<any[]>();
    const meetings = new Subject<any[]>();
    mocks.meetings.meetings$ = meetings;
    mocks.backend.videos$ = videos;
    mocks.backend.configData$ = config;
    mocks.videoLists.lists$ = lists;
    const state = fixture.componentInstance.state;
    fixture.detectChanges();
    const panel = fixture.debugElement.query(By.directive(MeetingsPanelLayout)).componentInstance as MeetingsPanelLayout;
    meetings.next([{ id: 'm1', url: 'https://zoom.us/j/1' }]);
    videos.next([makeVideo('videos/a.mp4')]);
    config.next({ botId: 'b1', busyRow: 'a', playing: true, globalVideoOrder: ['videos/a.mp4'] });
    lists.next([{ id: 'l1', name: 'Lista', videoPaths: ['videos/a.mp4'] }]);
    expect(state.loading).toBeFalse();
    expect(state.botId).toBe('b1');
    expect(state.videoLists.length).toBe(1);
    fixture.destroy();
    meetings.next([]);
    expect(panel.meetings.length).toBe(1);
    videos.next([]);
    config.next({ botId: 'changed' });
    lists.next([]);
    expect(state.videos.length).toBe(1);
    expect(state.botId).toBe('b1');
    expect(state.videoLists.length).toBe(1);
  });

  it('coordinates a Drive search from meetings with the Drive layout', async () => {
    mocks.backend.listDriveFiles.and.returnValue(new Subject());
    fixture.detectChanges();
    const meetings = fixture.debugElement.query(By.directive(MeetingsPanelLayout)).componentInstance as MeetingsPanelLayout;
    const drive = fixture.debugElement.query(By.directive(DriveImportLayout)).componentInstance as DriveImportLayout;
    meetings.updateDriveSearch('504');
    expect(fixture.componentInstance.state.driveSearchQuery()).toBe('504');
    expect(drive.isDriveExpanded()).toBeTrue();
    expect(mocks.backend.listDriveFiles).toHaveBeenCalledTimes(1);
    drive.driveFiles = [{ id: 'f1', name: '504 Himno', mimeType: 'video/mp4' }, { id: 'f2', name: 'Otro', mimeType: 'video/mp4' }];
    expect(drive.filteredDriveFiles.map(file => file.id)).toEqual(['f1']);
  });

  it('shares selection and reorder state without sharing layout-local forms', async () => {
    fixture.detectChanges();
    const state = fixture.componentInstance.state;
    state.videos = [makeVideo('videos/a.mp4'), makeVideo('videos/b.mp4')];
    state.globalVideoOrder = ['videos/a.mp4', 'videos/b.mp4'];
    const table = fixture.debugElement.query(By.directive(VideosTableLayout)).componentInstance as VideosTableLayout;
    const selection = fixture.debugElement.query(By.directive(SelectionBarLayout)).componentInstance as SelectionBarLayout;
    const actions = fixture.debugElement.query(By.directive(GlobalActionsLayout)).componentInstance as GlobalActionsLayout;
    table.toggle('videos/a.mp4');
    expect(selection.selectedList().map(video => video.videoPath)).toEqual(['videos/a.mp4']);
    await actions.toggleReorder();
    table.drop({ previousIndex: 0, currentIndex: 1 } as any);
    expect(table.displayedVideos.map(video => video.videoPath)).toEqual(['videos/b.mp4', 'videos/a.mp4']);
    actions.cancelReorder();
    expect(table.displayedVideos.map(video => video.videoPath)).toEqual(['videos/a.mp4', 'videos/b.mp4']);
  });

  it('keeps bot and playback state shared while each layout executes its own action', async () => {
    fixture.detectChanges();
    const state = fixture.componentInstance.state;
    const panel = fixture.debugElement.query(By.directive(MeetingsPanelLayout)).componentInstance as MeetingsPanelLayout;
    const table = fixture.debugElement.query(By.directive(VideosTableLayout)).componentInstance as VideosTableLayout;
    const actions = fixture.debugElement.query(By.directive(GlobalActionsLayout)).componentInstance as GlobalActionsLayout;
    panel.meetings = [{ id: 'm1', url: 'https://zoom.us/j/1' }];
    panel.selectMeeting('m1');
    await panel.createBot();
    expect(mocks.backend.createBot).toHaveBeenCalledWith('https://zoom.us/j/1');
    expect(state.botId).toBe('bot123');
    const video = makeVideo('videos/a.mp4');
    await table.playSingle(video);
    expect(mocks.backend.outputMedia).toHaveBeenCalledWith('bot123', video.videoUrl);
    expect(mocks.backend.setConfig.calls.allArgs().some(([config]: any[]) => config.busyRow === video.videoPath)).toBeTrue();
    expect(state.busyRow).toBe('');
    await actions.stopNow();
    expect(mocks.backend.stopMedia).toHaveBeenCalledWith('bot123');
    expect(state.playing).toBeFalse();
    await panel.removeBot();
    expect(mocks.backend.removeBot).toHaveBeenCalledWith('bot123');
    expect(state.botId).toBe('');
  });

  it('creates a list from table selection and clears the shared checkboxes', async () => {
    fixture.detectChanges();
    const state = fixture.componentInstance.state;
    state.videos = [makeVideo('videos/a.mp4'), makeVideo('videos/b.mp4')];
    const table = fixture.debugElement.query(By.directive(VideosTableLayout)).componentInstance as VideosTableLayout;
    const selection = fixture.debugElement.query(By.directive(SelectionBarLayout)).componentInstance as SelectionBarLayout;
    table.toggle('videos/b.mp4');
    selection.newListTitle = 'Mi lista';
    await selection.createNewList();
    expect(mocks.videoLists.addList).toHaveBeenCalledWith('Mi lista', ['videos/b.mp4']);
    expect(state.selectedMap).toEqual({});
    expect(selection.newListTitle).toBe('');
  });

});
