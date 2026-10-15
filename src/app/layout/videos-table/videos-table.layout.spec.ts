import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideosTableLayout } from './videos-table.layout';
import { HomeStore } from '../../pages/home/home.store';
import { createHomeServiceMocks, makeVideo, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('VideosTableLayout', () => {
  let fixture: ComponentFixture<VideosTableLayout>;
  let store: HomeStore;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideosTableLayout],
      providers: [HomeStore, ...provideHomeServiceMocks(createHomeServiceMocks())]
    }).compileComponents();

    store = TestBed.inject(HomeStore);
    fixture = TestBed.createComponent(VideosTableLayout);
    el = fixture.nativeElement;
  });

  const rows = () => Array.from(el.querySelectorAll('tbody tr[cdkDrag]')) as HTMLTableRowElement[];

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show "Cargando..." while loading', () => {
    store.loading = true;
    fixture.detectChanges();
    expect(el.textContent).toContain('Cargando...');
  });

  it('should show "No hay videos" when there are no videos', () => {
    store.loading = false;
    store.videos = [];
    fixture.detectChanges();
    expect(el.textContent).toContain('No hay videos');
  });

  it('should render one row per displayed video with its name', () => {
    store.loading = false;
    store.videos = [makeVideo('videos/uno.mp4'), makeVideo('videos/dos.mp4')];
    fixture.detectChanges();

    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('uno.mp4');
    expect(rows()[1].textContent).toContain('dos.mp4');
  });

  it('should toggle selection with the row checkbox', () => {
    store.loading = false;
    store.videos = [makeVideo('videos/uno.mp4')];
    fixture.detectChanges();

    const checkbox = rows()[0].querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.click();

    expect(store.selectedMap['videos/uno.mp4']).toBeTrue();
  });

  it('should show the drag handle instead of the checkbox in reorder mode', () => {
    store.loading = false;
    store.videos = [makeVideo('videos/uno.mp4')];
    store.reorderMode = true;
    fixture.detectChanges();

    expect(rows()[0].querySelector('input[type="checkbox"]')).toBeNull();
    expect(rows()[0].querySelector('svg')).toBeTruthy();
  });

  it('should disable "Reproducir" without a bot and call playSingle with one', () => {
    store.loading = false;
    const video = makeVideo('videos/uno.mp4');
    store.videos = [video];
    fixture.detectChanges();

    const playBtn = rows()[0].querySelector('button') as HTMLButtonElement;
    expect(playBtn.disabled).toBeTrue();

    store.botId = 'bot-1';
    fixture.detectChanges();
    const playSpy = spyOn(store, 'playSingle').and.returnValue(Promise.resolve());
    playBtn.click();

    expect(playSpy).toHaveBeenCalledWith(video);
  });

  it('should show "..." on the row that is currently playing', () => {
    store.loading = false;
    store.botId = 'bot-1';
    store.videos = [makeVideo('videos/uno.mp4')];
    store.busyRow = 'videos/uno.mp4';
    fixture.detectChanges();

    const playBtn = rows()[0].querySelector('button') as HTMLButtonElement;
    expect(playBtn.textContent?.trim()).toBe('...');
    expect(playBtn.disabled).toBeTrue();
  });

  it('getName should return the file name after the folder', () => {
    expect(fixture.componentInstance.getName('videos/himno.mp4')).toBe('himno.mp4');
  });
});
