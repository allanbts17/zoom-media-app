import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { defer, Observable, switchMap, timeout } from 'rxjs';

import {
  ZoomBot, ZoomBotCapacity, ZoomBotEventQuery, ZoomBotEvents, ZoomBotJoinRequest, ZoomBotList,
  ZoomVmState, ZoomBotListQuery, ZoomBotMedia, ZoomBotOperation, ZoomBotReadiness, ZoomBotTicket,
} from '../interfaces';

/** Client for our Express backend, which authenticates onward to Cloud Run. */
@Injectable({ providedIn: 'root' })
export class ZoomBotService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly base = '/zoom-bot';

  getVm(operation?: string): Observable<ZoomVmState> {
    return this.request<ZoomVmState>('GET', '/vm', undefined, undefined,
      operation ? new HttpParams().set('operation', operation) : undefined).pipe(timeout(20000));
  }

  startVm(key = this.newIdempotencyKey()): Observable<ZoomVmState> {
    return this.request<ZoomVmState>('POST', '/vm/start', {}, key).pipe(timeout(20000));
  }

  stopVm(key = this.newIdempotencyKey()): Observable<ZoomVmState> {
    return this.request<ZoomVmState>('POST', '/vm/stop', {}, key).pipe(timeout(20000));
  }

  getLiveness(): Observable<{ status: 'ok' }> {
    return this.request('GET', '/health/live');
  }

  getReadiness(): Observable<ZoomBotReadiness> {
    return this.request<ZoomBotReadiness>('GET', '/health/ready').pipe(timeout(10000));
  }

  getCapacity(): Observable<ZoomBotCapacity> {
    return this.request('GET', '/capacity');
  }

  /** listBots({ status: 'active' }) returns only active sessions; omit status for all. */
  listBots(query: ZoomBotListQuery = {}): Observable<ZoomBotList> {
    return this.request('GET', '/bots', undefined, undefined, this.params(query));
  }

  /** Creates a meeting session with no media. Keep this key when retrying this attempt. */
  joinBot(body: ZoomBotJoinRequest, key = this.newIdempotencyKey()): Observable<ZoomBotTicket> {
    return this.request('POST', '/bots', body, key);
  }

  getBot(botId: string): Observable<ZoomBot> {
    return this.request('GET', `/bots/${this.id(botId)}`);
  }

  leaveBot(botId: string, key = this.newIdempotencyKey()): Observable<ZoomBotTicket> {
    return this.request('DELETE', `/bots/${this.id(botId)}`, undefined, key);
  }

  getEvents(botId: string, query: ZoomBotEventQuery = {}): Observable<ZoomBotEvents> {
    return this.request('GET', `/bots/${this.id(botId)}/events`, undefined, undefined,
      this.params(query));
  }

  getOperation(operationId: string): Observable<ZoomBotOperation> {
    return this.request('GET', `/operations/${this.id(operationId)}`);
  }

  /** Starts video, audio or image; acceptance does not mean playback is already running. */
  play(botId: string, media: ZoomBotMedia, key = this.newIdempotencyKey()): Observable<ZoomBotTicket> {
    return this.request('POST', `/bots/${this.id(botId)}/play`, { media }, key);
  }

  pause(botId: string, playbackId?: string, key = this.newIdempotencyKey()): Observable<ZoomBotTicket> {
    return this.control(botId, 'pause', playbackId, key);
  }

  resume(botId: string, playbackId?: string, key = this.newIdempotencyKey()): Observable<ZoomBotTicket> {
    return this.control(botId, 'resume', playbackId, key);
  }

  stop(botId: string, playbackId?: string, key = this.newIdempotencyKey()): Observable<ZoomBotTicket> {
    return this.control(botId, 'stop', playbackId, key);
  }

  newIdempotencyKey(): string {
    return globalThis.crypto.randomUUID();
  }

  private control(botId: string, action: 'pause' | 'resume' | 'stop', playbackId: string | undefined,
    key: string): Observable<ZoomBotTicket> {
    const body = playbackId ? { playback_id: this.id(playbackId) } : {};
    return this.request('POST', `/bots/${this.id(botId)}/${action}`, body, key);
  }

  private request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown,
    key?: string, params?: HttpParams): Observable<T> {
    // Deferred until subscription: uses the current user and a fresh/cached valid Firebase token.
    return defer(async () => {
      await this.auth.authStateReady();
      const user = this.auth.currentUser;
      if (!user) throw new Error('ZOOM_BOT_LOGIN_REQUIRED');
      return user.getIdToken();
    }).pipe(switchMap(token => {
      let headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      if (key) headers = headers.set('Idempotency-Key', key);
      return this.http.request<T>(method, `${this.base}${path}`, { body, headers, params });
    }));
  }

  private params(query: ZoomBotListQuery | ZoomBotEventQuery): HttpParams {
    let params = new HttpParams();
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params = params.set(name, String(value));
    }
    return params;
  }

  private id(value: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error('ZOOM_BOT_INVALID_ID');
    }
    return value;
  }
}
