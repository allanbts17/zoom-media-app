import { videoToMediaItem, audioToMediaItem } from '../../shared/utils/media-item.utils';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MediaTableLayout } from './media-table.layout';
import { HomeStateService } from '../../pages/home/home-state.service';
import { createHomeServiceMocks, makeVideo, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('MediaTableLayout', () => {
  let fixture: ComponentFixture<MediaTableLayout>;
  let state: HomeStateService;
  let component: MediaTableLayout;
  let mocks: ReturnType<typeof createHomeServiceMocks>;
  let el: HTMLElement;

  beforeEach(async () => {
    mocks = createHomeServiceMocks();
    await TestBed.configureTestingModule({
      imports: [MediaTableLayout],
      providers: [HomeStateService, ...provideHomeServiceMocks(mocks)]
    }).compileComponents();

    state = TestBed.inject(HomeStateService);
    fixture = TestBed.createComponent(MediaTableLayout);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  const rows = () => Array.from(el.querySelectorAll('tbody tr[cdkDrag]')) as HTMLTableRowElement[];

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show "Cargando..." while loading', () => {
    state.loading = true;
    fixture.detectChanges();
    expect(el.textContent).toContain('Cargando...');
  });

  it('should show "No hay videos" when there are no videos', () => {
    state.loading = false;
    state.videos = [];
    fixture.detectChanges();
    expect(el.textContent).toContain('No hay videos');
  });

  it('should render one row per displayed video with its name', () => {
    state.loading = false;
    state.videos = [makeVideo('videos/uno.mp4'), makeVideo('videos/dos.mp4')];
    fixture.detectChanges();

    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('uno.mp4');
    expect(rows()[1].textContent).toContain('dos.mp4');
  });

  it('should toggle selection with the row checkbox', () => {
    state.loading = false;
    state.videos = [makeVideo('videos/uno.mp4')];
    fixture.detectChanges();

    const checkbox = rows()[0].querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.click();

    expect(state.selectedMap['videos/uno.mp4']).toBeTrue();
  });

  it('should show the drag handle instead of the checkbox in reorder mode', () => {
    state.loading = false;
    state.videos = [makeVideo('videos/uno.mp4')];
    state.reorderMode = true;
    fixture.detectChanges();

    expect(rows()[0].querySelector('input[type="checkbox"]')).toBeNull();
    expect(rows()[0].querySelector('svg')).toBeTruthy();
  });

  it('should disable "Reproducir" without a bot and call playSingle with one', () => {
    state.loading = false;
    const video = makeVideo('videos/uno.mp4');
    state.videos = [video];
    fixture.detectChanges();

    const playBtn = rows()[0].querySelector('button') as HTMLButtonElement;
    expect(playBtn.disabled).toBeTrue();

    state.botId = 'bot-1';
    fixture.detectChanges();
    const playSpy = spyOn(component, 'playSingle').and.returnValue(Promise.resolve());
    playBtn.click();

    expect(playSpy).toHaveBeenCalledWith(videoToMediaItem(video));
  });

  it('should show "..." on the row that is currently playing', () => {
    state.loading = false;
    state.botId = 'bot-1';
    state.videos = [makeVideo('videos/uno.mp4')];
    state.busyRow = 'videos/uno.mp4';
    fixture.detectChanges();

    const playBtn = rows()[0].querySelector('button') as HTMLButtonElement;
    expect(playBtn.textContent?.trim()).toBe('...');
    expect(playBtn.disabled).toBeTrue();
  });

  it('getName should return the file name after the folder', () => {
    expect(fixture.componentInstance.getName('videos/himno.mp4')).toBe('himno.mp4');
  });
  it('should calculate displayedMedia correctly for all list', () => {
    state.videos = [
      { videoPath: 'v1', videoUrl: 'u1', duration: 10, thumbnailPath: '', thumbnailUrl: '' },
      { videoPath: 'v2', videoUrl: 'u2', duration: 10, thumbnailPath: '', thumbnailUrl: '' }
    ];
    state.globalVideoOrder = ['v2', 'v1'];
    state.activeListId.set('all');

    const displayed = component.displayedMedia;
    expect(displayed[0].path).toBe('v2');
    expect(displayed[1].path).toBe('v1');
  });

  it('should only show videos of the active list, in the list order', () => {
    state.videos = [makeVideo('v1'), makeVideo('v2'), makeVideo('v3')];
    state.videoLists = [{ id: 'l1', name: 'Lista', videoPaths: ['v3', 'v1'] }];
    state.activeListId.set('l1');

    expect(component.displayedMedia.map(v => v.path)).toEqual(['v3', 'v1']);
  });
  it('filters the visible name ignoring case, accents and surrounding spaces', () => {
    state.videos = [makeVideo('videos/Canción.mp4'), makeVideo('videos/Otro.mp4')];
    state.videoSearchQuery.set('  CANCION  ');
    expect(component.displayedMedia.map(v => v.path)).toEqual(['videos/Canción.mp4']);
    state.videoSearchQuery.set('videos');
    expect(component.displayedMedia).toEqual([]);
    state.videoSearchQuery.set('');
    expect(component.displayedMedia.length).toBe(2);
  });

  it('combines search with the active list and keeps its order', () => {
    state.videos = [makeVideo('videos/uno.mp4'), makeVideo('videos/dos.mp4'), makeVideo('videos/tres.mp4')];
    state.videoLists = [{ id: 'l1', name: 'Lista', videoPaths: ['videos/tres.mp4', 'videos/uno.mp4'] }];
    state.activeListId.set('l1');
    state.videoSearchQuery.set('.mp4');
    expect(component.displayedMedia.map(v => v.path)).toEqual(['videos/tres.mp4', 'videos/uno.mp4']);
  });

  it('preserves hidden videos when reordering search results', () => {
    state.videos = [makeVideo('videos/a1.mp4'), makeVideo('videos/hidden.mp4'), makeVideo('videos/a2.mp4')];
    state.reorderMode = true;
    state.videoSearchQuery.set('a');
    component.drop({ previousIndex: 0, currentIndex: 1 } as any);
    expect(state.globalVideoOrder).toEqual(['videos/a2.mp4', 'videos/hidden.mp4', 'videos/a1.mp4']);
  });

  it('shows audio-only lists without videos', () => {
    state.audioLoading = false;
    state.audios = [{audioPath:'audios/a.mp3',audioUrl:'https://storage/a.mp3',duration:12}];
    state.videoLists = [{id:'audio',name:'Audio',videoPaths:[],audioPaths:['audios/a.mp3']}];
    state.activeListId.set('audio'); component.selectTab('audios'); fixture.detectChanges();
    expect(rows().length).toBe(1); expect(el.textContent).toContain('a.mp3');
  });
  it('treats missing audioPaths as empty and preserves video order', () => {
    state.videoLists = [{id:'legacy',name:'Legacy',videoPaths:['videos/a.mp4']}];
    state.activeListId.set('legacy'); component.selectTab('audios');
    expect(component.displayedMedia).toEqual([]);
    expect(state.videoLists[0].videoPaths).toEqual(['videos/a.mp4']);
  });
  it('reorders audios without changing video paths', () => {
    state.audios = [{audioPath:'audios/a.mp3',audioUrl:'a',duration:1},{audioPath:'audios/b.wav',audioUrl:'b',duration:1}];
    state.videoLists = [{id:'mixed',name:'Mixed',videoPaths:['videos/v.mp4'],audioPaths:['audios/a.mp3','audios/b.wav']}];
    state.activeListId.set('mixed'); component.selectTab('audios'); state.reorderMode = true;
    component.drop({previousIndex:0,currentIndex:1} as any);
    expect(state.videoLists[0].audioPaths).toEqual(['audios/b.wav','audios/a.mp3']);
    expect(state.videoLists[0].videoPaths).toEqual(['videos/v.mp4']);
  });
  it('plays audio through the bot audio command', async () => {
    component.selectTab('audios'); state.botId = 'bot-1';
    await component.playSingle(audioToMediaItem({audioPath:'audios/a.mp3',audioUrl:'https://storage/audios/a.mp3',duration:10}));
    expect(mocks.backend.play).toHaveBeenCalledWith('bot-1','audio','https://storage/audios/a.mp3');
  });
  it('blocks tab changes during reordering', () => {
    state.reorderMode = true; component.selectTab('audios'); expect(state.activeTab()).toBe('videos');
  });
  it('opens Drive and reuses an already loaded empty result', async () => {
    component.openDrive(); await Promise.resolve();
    component.selectTab('videos'); component.openDrive();
    expect(state.activeTab()).toBe('drive'); expect(mocks.backend.listDriveFiles).toHaveBeenCalledTimes(1);
  });
  for (const tab of ['videos', 'audios'] as const) {
    it('keeps ' + tab + ' action elements alive between mousedown and click', () => {
      state.loading = false;
      state.audioLoading = false;
      state.botId = 'bot-1';
      state.videos = [makeVideo('videos/a.mp4')];
      state.audios = [{audioPath:'audios/a.mp3',audioUrl:'https://storage/a.mp3',duration:10}];
      component.selectTab(tab);
      fixture.detectChanges();
      const row = rows()[0];
      const button = row.querySelector('button') as HTMLButtonElement;
      const link = row.querySelector('a') as HTMLAnchorElement;
      const playSpy = spyOn(component, 'playSingle').and.returnValue(Promise.resolve());

      button.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
      fixture.detectChanges();
      expect(rows()[0]).toBe(row);
      expect(rows()[0].querySelector('button')).toBe(button);
      button.click();
      expect(playSpy).toHaveBeenCalledWith(jasmine.objectContaining({type:tab === 'audios' ? 'audio' : 'video'}));

      link.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
      fixture.detectChanges();
      expect(rows()[0].querySelector('a')).toBe(link);
      expect(link.isConnected).toBeTrue();
      expect(link.getAttribute('href')).toBe(tab === 'audios' ? 'https://storage/a.mp3' : 'https://storage/videos/a.mp4');
      expect(link.target).toBe('_blank');
    });
  }
});
