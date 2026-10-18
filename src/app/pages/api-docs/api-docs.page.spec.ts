import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { signal, computed } from '@angular/core';
import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { User } from 'firebase/auth';
import { ApiDocsPage } from './api-docs.page';
import { AuthService } from '../../shared/services/auth.service';
import { authenticatedGuard } from '../../shared/guards/auth.guard';

const botId = '11223344-5566-4788-99aa-bbccddeeff00';
const operationId = 'aabbccdd-1122-4334-8556-77889900aabb';

describe('ApiDocsPage laboratory', () => {
  let page: ApiDocsPage;
  let http: HttpTestingController;
  let auth: { user: ReturnType<typeof signal<User | null>>; username: ReturnType<typeof computed<string>>; waitForSession: jasmine.Spy };
  let user: User;
  beforeEach(async () => {
    user = { email: 'allan@example.com', getIdToken: jasmine.createSpy().and.returnValue(Promise.resolve('session-token')) } as unknown as User;
    auth = { user: signal<User | null>(user), username: computed(() => 'allan'), waitForSession: jasmine.createSpy().and.callFake(async () => auth.user()) };
    await TestBed.configureTestingModule({ imports: [ApiDocsPage], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(ApiDocsPage);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    page.select(page.endpoints.find(endpoint => endpoint.id === 'live')!);
  });
  afterEach(() => http.verify());
  function select(id: string) { page.select(page.endpoints.find(endpoint => endpoint.id === id)!); }

  it('covers the sixteen backend endpoints', () => {
    expect(page.endpoints.map(e => `${e.method} ${e.path}`)).toEqual([
      'GET /vm', 'POST /vm/start', 'POST /vm/stop',
      'GET /health/live', 'GET /health/ready', 'GET /capacity', 'GET /bots', 'POST /bots',
      'GET /bots/{bot_id}', 'DELETE /bots/{bot_id}', 'GET /bots/{bot_id}/events',
      'GET /operations/{operation_id}', 'POST /bots/{bot_id}/play',
      'POST /bots/{bot_id}/pause', 'POST /bots/{bot_id}/resume', 'POST /bots/{bot_id}/stop',
    ]);
  });
  it('authenticates every request and captures a 202 ticket without pretending it completed', fakeAsync(() => {
    select('join'); const key = page.idempotencyKey; const body = page.body;
    page.execute(); flushMicrotasks();
    const req = http.expectOne('/zoom-bot/bots');
    expect(req.request.headers.get('Authorization')).toBe('Bearer session-token');
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    expect(req.request.body).toBe(body);
    req.flush(JSON.stringify({ bot_id: botId, operation_id: operationId, status: 'queued' }), { status: 202, statusText: 'Accepted', headers: new HttpHeaders({ 'x-request-id': 'request-one' }) });
    expect(page.response()?.status).toBe(202);
    expect(page.response()?.headers).toContain('x-request-id: request-one');
    expect(page.botId).toBe(botId); expect(page.operationId).toBe(operationId);
    expect(page.idempotencyKey).toBe(key); expect(page.busy()).toBeFalse();
  }));
  it('shows a 422 response verbatim and never retries', fakeAsync(() => {
    select('join'); page.execute(); flushMicrotasks();
    http.expectOne('/zoom-bot/bots').flush('{"error":{"code":"VALIDATION_ERROR"}}', { status: 422, statusText: 'Unprocessable Content' });
    expect(page.response()?.status).toBe(422); expect(page.response()?.body).toContain('VALIDATION_ERROR');
    http.expectNone('/zoom-bot/bots'); expect(page.busy()).toBeFalse();
  }));
  it('shows VM unavailable and non-JSON responses without requiring the VM', fakeAsync(() => {
    select('ready'); page.execute(); flushMicrotasks();
    http.expectOne('/zoom-bot/health/ready').flush('agent unavailable', { status: 503, statusText: 'Service Unavailable' });
    expect(page.response()?.body).toBe('agent unavailable'); expect(page.response()?.status).toBe(503);
  }));
  it('allows invalid JSON and missing idempotency keys to test backend validation', fakeAsync(() => {
    select('join'); page.body = '{invalid'; page.idempotencyKey = ''; page.execute(); flushMicrotasks();
    const req = http.expectOne('/zoom-bot/bots');
    expect(req.request.body).toBe('{invalid'); expect(req.request.headers.has('Idempotency-Key')).toBeFalse();
    req.flush('{}');
  }));
  it('retains the same key on an explicit retry and changes it only on request', fakeAsync(() => {
    select('join'); const key = page.idempotencyKey;
    for (let i = 0; i < 2; i++) {
      page.execute(); flushMicrotasks(); const req = http.expectOne('/zoom-bot/bots');
      expect(req.request.headers.get('Idempotency-Key')).toBe(key); req.flush('{}');
    }
    page.newKey(); expect(page.idempotencyKey).not.toBe(key);
  }));
  it('passes query values and extra headers and safely encodes path identifiers', fakeAsync(() => {
    select('events'); page.botId = botId; page.query = '?limit=2&after_sequence=4'; page.extraHeaders = '{"X-Lab":"example"}';
    page.execute(); flushMicrotasks(); const req = http.expectOne(`/zoom-bot/bots/${botId}/events?limit=2&after_sequence=4`);
    expect(req.request.headers.get('X-Lab')).toBe('example'); req.flush('{}');
    page.botId = 'a/b?c'; expect(page.url).toContain('/bots/a%2Fb%3Fc/events');
  }));
  it('refuses to substitute another Authorization header', () => {
    page.extraHeaders = '{"authorization":"Bearer other"}'; page.execute();
    expect(page.notice()).toContain('sesión'); http.expectNone('/zoom-bot/health/live');
  });
  it('does not submit without a Firebase session', fakeAsync(() => {
    auth.waitForSession.and.returnValue(Promise.resolve(null)); page.execute(); flushMicrotasks();
    http.expectNone('/zoom-bot/health/live'); expect(page.notice()).toContain('Sesión cerrada');
  }));
  it('waits for the Firebase token, prevents duplicate sends and uses a fresh token next time', fakeAsync(() => {
    page.execute(); page.execute(); flushMicrotasks();
    http.expectOne('/zoom-bot/health/live').flush('{}');
    (user.getIdToken as jasmine.Spy).and.returnValue(Promise.resolve('new-token'));
    page.execute(); flushMicrotasks(); const req = http.expectOne('/zoom-bot/health/live');
    expect(req.request.headers.get('Authorization')).toBe('Bearer new-token'); req.flush('{}');
  }));
  it('cancels the browser wait without claiming the backend command was cancelled', fakeAsync(() => {
    select('live'); page.execute(); flushMicrotasks(); const req = http.expectOne('/zoom-bot/health/live'); page.cancel();
    expect(req.cancelled).toBeTrue(); expect(page.notice()).toContain('puede seguir ejecutándose');
  }));
  it('protects the route when the restored session is absent', async () => {
    auth.waitForSession.and.returnValue(Promise.resolve(null));
    const result = await TestBed.runInInjectionContext(() => authenticatedGuard({} as never, {} as never));
    expect(result instanceof UrlTree).toBeTrue();
  });
});
