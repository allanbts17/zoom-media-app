import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from '@angular/fire/auth';
import { ZoomBotService } from './zoom-bot.service';

const botId = '11223344-5566-4788-99aa-bbccddeeff00';

describe('ZoomBotService protocol', () => {
  let service: ZoomBotService;
  let http: HttpTestingController;
  let user: { getIdToken: jasmine.Spy };
  let auth: { authStateReady: jasmine.Spy; currentUser: typeof user | null };

  beforeEach(() => {
    user = { getIdToken: jasmine.createSpy().and.returnValue(Promise.resolve('firebase-token')) };
    auth = { authStateReady: jasmine.createSpy().and.returnValue(Promise.resolve()), currentUser: user };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: Auth, useValue: auth }] });
    service = TestBed.inject(ZoomBotService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the Firebase token to the backend and refreshes its value between requests', fakeAsync(() => {
    service.getCapacity().subscribe();
    flushMicrotasks();
    const first = http.expectOne('/zoom-bot/capacity');
    expect(first.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    first.flush({});
    user.getIdToken.and.returnValue(Promise.resolve('new-firebase-token'));
    service.getReadiness().subscribe();
    flushMicrotasks();
    const second = http.expectOne('/zoom-bot/health/ready');
    expect(second.request.headers.get('Authorization')).toBe('Bearer new-firebase-token');
    second.flush({});
  }));

  it('does not send a request when there is no authenticated user', fakeAsync(() => {
    auth.currentUser = null;
    let message = '';
    service.getCapacity().subscribe({ error: e => message = e.message });
    flushMicrotasks();
    expect(message).toBe('ZOOM_BOT_LOGIN_REQUIRED');
    http.expectNone('/zoom-bot/capacity');
  }));

  it('reuses an attempt key on resubscription but creates a new key for a new join', fakeAsync(() => {
    const body = { meeting: { number: '123456789' } };
    const attempt = service.joinBot(body);
    attempt.subscribe();
    flushMicrotasks();
    const first = http.expectOne('/zoom-bot/bots');
    const key = first.request.headers.get('Idempotency-Key');
    expect(key).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    first.flush({});
    attempt.subscribe();
    flushMicrotasks();
    const second = http.expectOne('/zoom-bot/bots');
    expect(second.request.headers.get('Idempotency-Key')).toBe(key);
    second.flush({});
    service.joinBot(body).subscribe();
    flushMicrotasks();
    const third = http.expectOne('/zoom-bot/bots');
    expect(third.request.headers.get('Idempotency-Key')).not.toBe(key);
    third.flush({});
  }));

  it('preserves the playback guard and an explicit idempotency key', fakeAsync(() => {
    service.pause(botId, botId, 'retry-same-control-key').subscribe();
    flushMicrotasks();
    const request = http.expectOne(`/zoom-bot/bots/${botId}/pause`);
    expect(request.request.body).toEqual({ playback_id: botId });
    expect(request.request.headers.get('Idempotency-Key')).toBe('retry-same-control-key');
    request.flush({});
  }));

  it('encodes cursor query parameters and never retries an HTTP error automatically', fakeAsync(() => {
    let status = 0;
    service.listBots({ cursor: 'a+b/==', limit: 20 }).subscribe({ error: e => status = e.status });
    flushMicrotasks();
    const request = http.expectOne(r => r.url === '/zoom-bot/bots');
    expect(request.request.params.get('cursor')).toBe('a+b/==');
    expect(request.request.params.get('limit')).toBe('20');
    request.flush({ error: { code: 'RATE_LIMITED' } }, { status: 429, statusText: 'Rate Limited' });
    flushMicrotasks();
    expect(status).toBe(429);
    http.expectNone(r => r.url === '/zoom-bot/bots');
  }));

  it('rejects a route injection before constructing a request', () => {
    expect(() => service.getBot('../health')).toThrowError('ZOOM_BOT_INVALID_ID');
  });
});
