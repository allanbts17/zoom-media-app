import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomePage } from './home.page';
import { HomeStore } from './home.store';
import { createHomeServiceMocks, HomeServiceMocks, provideHomeServiceMocks } from './testing/home-testing';

describe('HomePage', () => {
  let mocks: HomeServiceMocks;
  let fixture: ComponentFixture<HomePage>;
  let el: HTMLElement;

  beforeEach(async () => {
    mocks = createHomeServiceMocks();
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: provideHomeServiceMocks(mocks)
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    el = fixture.nativeElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should provide its own HomeStore instance', () => {
    const pageStore = fixture.debugElement.injector.get(HomeStore);
    expect(pageStore).toBe(fixture.componentInstance.store);
  });

  it('should call store.init() on ngOnInit', () => {
    const initSpy = spyOn(fixture.componentInstance.store, 'init').and.callThrough();
    fixture.detectChanges();
    expect(initSpy).toHaveBeenCalledTimes(1);
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

  it('should show the error banner only when store.err is set', () => {
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Algo falló');

    fixture.componentInstance.store.err = 'Algo falló';
    fixture.detectChanges();
    expect(el.textContent).toContain('Algo falló');
  });

  it('should share the same store between the page and its layouts', () => {
    fixture.detectChanges();
    const store = fixture.componentInstance.store;
    store.botId = 'bot-shared';
    fixture.detectChanges();
    // Rendered by MeetingsPanelLayout
    expect(el.querySelector('app-meetings-panel')?.textContent).toContain('bot-shared');
  });
});
