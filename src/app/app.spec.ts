import { User } from 'firebase/auth';
import { LoginPage } from './pages/login/login.page';
import { UserMenuComponent } from './shared/components/user-menu/user-menu.component';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { HomePage } from './pages/home/home.page';
import { createHomeServiceMocks, provideHomeServiceMocks } from './pages/home/testing/home-testing';

describe('App', () => {
  let mocks: ReturnType<typeof createHomeServiceMocks>;
  beforeEach(async () => {
    mocks = createHomeServiceMocks();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        ...provideHomeServiceMocks(mocks)
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
  it('shows login at the root and denies direct home access without a session', async () => {
    mocks.auth.user.set(null);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', LoginPage);
    expect(harness.routeNativeElement?.textContent).toContain('Iniciar sesión');
    expect(harness.routeNativeElement?.querySelector('a')).toBeNull();
    await harness.navigateByUrl('/home', LoginPage);
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('waits for session restoration before creating home', async () => {
    mocks.auth.user.set(null);
    let resolve!: (user: User) => void;
    mocks.auth.waitForSession.and.returnValue(new Promise<User>(done => resolve = done));
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/home', HomePage);
    await Promise.resolve();
    expect(harness.routeNativeElement?.querySelector('app-meetings-panel')).toBeFalsy();
    const user = {uid: 'restored', email: 'allan@example.com'} as User;
    mocks.auth.user.set(user);
    resolve(user);
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/home');
  });

  it('completes Google access and opens home without another login', async () => {
    mocks.auth.user.set(null);
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/', LoginPage);
    await page.continueWithGoogle();
    expect(mocks.auth.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Router).url).toBe('/home');
  });

  it('unlocks the Google button after cancellation and hides private error details', async () => {
    mocks.auth.user.set(null);
    mocks.auth.signInWithGoogle.and.rejectWith({code: 'auth/popup-closed-by-user', message: 'private-token'});
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/', LoginPage);
    await page.continueWithGoogle();
    harness.detectChanges();
    expect(page.busy()).toBeFalse();
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent).toContain('La ventana se cerró');
    expect(harness.routeNativeElement?.textContent).not.toContain('private-token');
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('shows the email prefix and returns to login on logout, including a later direct home attempt', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home', HomePage);
    harness.detectChanges();
    const menu = harness.routeDebugElement!.query(By.directive(UserMenuComponent)).componentInstance as UserMenuComponent;
    expect(harness.routeNativeElement?.querySelector('app-user-menu')?.textContent).toContain('allan');
    menu.toggle();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('[role="menuitem"]')?.textContent).toContain('Cerrar sesión');
    await menu.logout();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
    await harness.navigateByUrl('/home', LoginPage);
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('redirects home when the session ends in another tab', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home', HomePage);
    mocks.auth.user.set(null);
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
  });
  it('keeps the user in home and shows an error when sign-out fails', async () => {
    mocks.auth.logout.and.rejectWith(new Error('network'));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home', HomePage);
    const menu = harness.routeDebugElement!.query(By.directive(UserMenuComponent)).componentInstance as UserMenuComponent;
    await menu.logout();
    harness.detectChanges();
    expect(menu.busy()).toBeFalse();
    expect(TestBed.inject(Router).url).toBe('/home');
    expect(harness.routeNativeElement?.querySelector('app-user-menu [role="alert"]')?.textContent).toContain('No se pudo cerrar');
  });

  it('closes the user dropdown with Escape and an outside click', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home', HomePage);
    const menu = harness.routeDebugElement!.query(By.directive(UserMenuComponent)).componentInstance as UserMenuComponent;
    menu.toggle();
    harness.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    expect(menu.open()).toBeFalse();
    menu.toggle();
    harness.detectChanges();
    document.body.click();
    expect(menu.open()).toBeFalse();
  });
});
