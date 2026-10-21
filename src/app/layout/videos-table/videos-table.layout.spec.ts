import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideosTableLayout } from './videos-table.layout';
import { HomeStateService } from '../../pages/home/home-state.service';
import { createHomeServiceMocks, makeVideo, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('VideosTableLayout', () => {
  let fixture: ComponentFixture<VideosTableLayout>;
  let state: HomeStateService;
  let component: VideosTableLayout;
  let mocks: ReturnType<typeof createHomeServiceMocks>;
  let el: HTMLElement;

  beforeEach(async () => {
    mocks = createHomeServiceMocks();
    await TestBed.configureTestingModule({
      imports: [VideosTableLayout],
      providers: [HomeStateService, ...provideHomeServiceMocks(mocks)]
    }).compileComponents();

    state = TestBed.inject(HomeStateService);
    fixture = TestBed.createComponent(VideosTableLayout);
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

    expect(playSpy).toHaveBeenCalledWith(video);
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
  it('should calculate displayedVideos correctly for all list', () => {
    state.videos = [
      { videoPath: 'v1', videoUrl: 'u1', duration: 10, thumbnailPath: '', thumbnailUrl: '' },
      { videoPath: 'v2', videoUrl: 'u2', duration: 10, thumbnailPath: '', thumbnailUrl: '' }
    ];
    state.globalVideoOrder = ['v2', 'v1'];
    state.activeListId.set('all');

    const displayed = component.displayedVideos;
    expect(displayed[0].videoPath).toBe('v2');
    expect(displayed[1].videoPath).toBe('v1');
  });

  it('should only show videos of the active list, in the list order', () => {
    state.videos = [makeVideo('v1'), makeVideo('v2'), makeVideo('v3')];
    state.videoLists = [{ id: 'l1', name: 'Lista', videoPaths: ['v3', 'v1'] }];
    state.activeListId.set('l1');

    expect(component.displayedVideos.map(v => v.videoPath)).toEqual(['v3', 'v1']);
  });
  it('filters the visible name ignoring case, accents and surrounding spaces', () => {
    state.videos = [makeVideo('videos/Canción.mp4'), makeVideo('videos/Otro.mp4')];
    state.videoSearchQuery.set('  CANCION  ');
    expect(component.displayedVideos.map(v => v.videoPath)).toEqual(['videos/Canción.mp4']);
    state.videoSearchQuery.set('videos');
    expect(component.displayedVideos).toEqual([]);
    state.videoSearchQuery.set('');
    expect(component.displayedVideos.length).toBe(2);
  });

  it('combines search with the active list and keeps its order', () => {
    state.videos = [makeVideo('videos/uno.mp4'), makeVideo('videos/dos.mp4'), makeVideo('videos/tres.mp4')];
    state.videoLists = [{ id: 'l1', name: 'Lista', videoPaths: ['videos/tres.mp4', 'videos/uno.mp4'] }];
    state.activeListId.set('l1');
    state.videoSearchQuery.set('.mp4');
    expect(component.displayedVideos.map(v => v.videoPath)).toEqual(['videos/tres.mp4', 'videos/uno.mp4']);
  });

  it('preserves hidden videos when reordering search results', () => {
    state.videos = [makeVideo('videos/a1.mp4'), makeVideo('videos/hidden.mp4'), makeVideo('videos/a2.mp4')];
    state.reorderMode = true;
    state.videoSearchQuery.set('a');
    component.drop({ previousIndex: 0, currentIndex: 1 } as any);
    expect(state.globalVideoOrder).toEqual(['videos/a2.mp4', 'videos/hidden.mp4', 'videos/a1.mp4']);
  });

});
