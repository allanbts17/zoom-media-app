import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { HomePage } from './pages/home/home.page';
import { createHomeServiceMocks, provideHomeServiceMocks } from './pages/home/testing/home-testing';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        ...provideHomeServiceMocks(createHomeServiceMocks())
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet and the global overlays', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('router-outlet')).toBeTruthy();
    expect(el.querySelector('app-confirm-modal')).toBeTruthy();
    expect(el.querySelector('app-loading-overlay')).toBeTruthy();
  });

  it('should redirect the root url to /home', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/', HomePage);
    expect(page).toBeInstanceOf(HomePage);
    expect(TestBed.inject(Router).url).toBe('/home');
  });

  it('should redirect unknown urls to /home', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/does-not-exist', HomePage);
    expect(TestBed.inject(Router).url).toBe('/home');
  });
});
