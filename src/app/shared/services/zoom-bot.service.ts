import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { defer, Observable, switchMap } from 'rxjs';

export type ZoomBotStatus = 'accepted' | 'preparing' | 'joining' | 'waiting_room' |
  'active' | 'reconnecting' | 'leaving' | 'ended' | 'failed';
export type ZoomBotPlaybackStatus = 'idle' | 'buffering' | 'waiting' | 'playing' |
  'paused' | 'stopped' | 'finished' | 'failed';
export type ZoomBotAction = 'join' | 'play' | 'pause' | 'resume' | 'stop' | 'leave';

export interface ZoomBotJoinRequest {
  meeting: { number: string; password?: string; participant_name?: string };
  options?: { waiting_room_timeout_seconds?: number; max_session_seconds?: number };
}
export type ZoomBotMedia =
  | { type: 'video'; url: string; audio_enabled?: boolean }
  | { type: 'audio'; url: string }
  | { type: 'image'; url: string; duration_seconds?: number | null };
export interface ZoomBotTicket {
  bot_id: string;
  operation_id: string;
  status: 'accepted' | 'queued' | 'succeeded';
  action: ZoomBotAction;
  playback_id?: string | null;
  no_op?: boolean;
  links: { bot: string; operation: string };
}
export interface ZoomBotPlayback {
  playback_id: string | null;
  media_type: 'video' | 'audio' | 'image' | null;
  status: ZoomBotPlaybackStatus;
  position_seconds: number | null;
  duration_seconds: number | null;
  audio_enabled: boolean | null;
  pause_reasons: string[];
  can_pause: boolean;
  can_resume: boolean;
  can_stop: boolean;
}
export interface ZoomBot {
  bot_id: string;
  status: ZoomBotStatus;
  meeting: {
    number: string;
    participant_name: string;
    status: string;
    audio_permission: boolean | null;
    video_permission: boolean | null;
  };
  playback: ZoomBotPlayback;
  media?: Record<string, unknown> | null;
  pending_operation_id?: string | null;
  resource_released: boolean;
  state_version?: number;
  created_at: string | null;
  updated_at?: string | null;
  last_error?: { code: string } | null;
}
export interface ZoomBotList {
  items: Array<Pick<ZoomBot, 'bot_id' | 'status' | 'created_at'> & {
    playback_status?: ZoomBotPlaybackStatus;
  }>;
  next_cursor: string | null;
}
export interface ZoomBotOperation {
  operation_id: string;
  bot_id: string;
  action: ZoomBotAction;
  playback_id: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  no_op: boolean;
  requested_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result: Record<string, unknown> | null;
  error: { code: string } | null;
}
export interface ZoomBotEvents {
  items: Array<{
    sequence: number;
    type: string;
    occurred_at: string | null;
    data: Record<string, unknown>;
  }>;
  next_after_sequence: number;
  has_more: boolean;
}
export interface ZoomBotCapacity {
  max_concurrent_bots: number;
  reserved_slots: number;
  available_slots: number;
  active_bot_id: string | null;
  accepting_new_sessions: boolean;
  worker_status: string;
}
export interface ZoomBotReadiness {
  status: 'ready' | 'not_ready';
  checks: { database: string; worker: string };
}
export interface ZoomBotListQuery {
  limit?: number;
  cursor?: string;
  status?: ZoomBotStatus;
}
export interface ZoomBotEventQuery { limit?: number; after_sequence?: number }

/** Client for our Express backend, which authenticates onward to Cloud Run. */
@Injectable({ providedIn: 'root' })
export class ZoomBotService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly base = '/zoom-bot';

  getLiveness(): Observable<{ status: 'ok' }> {
    return this.request('GET', '/health/live');
  }

  getReadiness(): Observable<ZoomBotReadiness> {
    return this.request('GET', '/health/ready');
  }

  getCapacity(): Observable<ZoomBotCapacity> {
    return this.request('GET', '/capacity');
  }

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
