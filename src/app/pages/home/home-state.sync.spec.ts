import { TestBed } from '@angular/core/testing';
import { HomeStateService } from './home-state.service';
import { BackendService } from '../../shared/services/backend.service';
import { ZoomBotRuntime } from '../../shared/interfaces/zoom-bot-runtime';

function runtime(sequence = 1, status = 'playing'): ZoomBotRuntime {
  return {
    schema_version: 1, publisher_id: 'agent-1', sequence, observed_at: 1000, expires_at: 1090,
    agent_online: true, media_path: 'videos/current.mp4', preparation: null, operation: null,
    bot: {bot_id: 'bot-1', status: 'active', resource_released: false, pending_operation_id: null, last_error: null,
      playback: {playback_id: 'current', media_type: 'video', status: status as any,
        position_seconds: null, duration_seconds: 60, audio_enabled: true, pause_reasons: [],
        can_pause: true, can_resume: true, can_stop: true}},
  };
}

describe('Shared agent state', () => {
  let a: HomeStateService;
  let b: HomeStateService;
  const now = 1000 * 1000;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [HomeStateService, {provide: BackendService, useValue: {}}]});
    a = TestBed.inject(HomeStateService);
    b = TestBed.runInInjectionContext(() => new HomeStateService());
  });

  it('shows the same preparation on two devices while keeping actual playback', () => {
    const value = runtime();
    value.preparation = {playback_id:'next', operation_id:'op-next', status:'preparing', error:null, media_path:'videos/next.mp4'};
    a.applyRuntime(value, now); b.applyRuntime(value, now);
    expect(a.busyRow).toBe('videos/next.mp4'); expect(b.busyRow).toBe(a.busyRow);
    expect(a.playbackId).toBe('current'); expect(b.playing).toBeTrue();
    expect(a.mediaChangeMessage).toContain('actual continúa');
  });

  it('supersedes local responses and rejects old sequence snapshots', () => {
    const localRequest = ++a.mediaRequestVersion;
    a.applyRuntime(runtime(2), now);
    expect(a.mediaRequestVersion).toBeGreaterThan(localRequest);
    a.applyRuntime(runtime(1, 'paused'), now);
    expect(a.botAction).toBe('play');
    a.applyRuntime(runtime(3, 'paused'), now);
    expect(a.botAction).toBe('pause'); expect(a.playing).toBeFalse();
  });

  it('clears stale preparation and recovers on a new heartbeat', () => {
    const value = runtime(); value.preparation = {playback_id:'next',operation_id:'op',status:'preparing',error:null,media_path:'videos/next.mp4'};
    a.applyRuntime(value, now);
    a.checkRuntimeFreshness(1091 * 1000);
    expect(a.syncFresh).toBeFalse(); expect(a.busyRow).toBe(''); expect(a.syncMessage).toContain('Estado sin confirmar');
    const fresh = runtime(2); fresh.observed_at = 1092; fresh.expires_at = 1182;
    a.applyRuntime(fresh, 1092 * 1000);
    expect(a.syncFresh).toBeTrue(); expect(a.syncMessage).toBe('');
  });

  it('keeps old media when preparation fails, and reflects EOF and leave', () => {
    const value = runtime(); value.preparation = {playback_id:'next',operation_id:'op',status:'failed',error:{code:'MEDIA_RANGE_FAILED'},media_path:'videos/next.mp4'};
    a.applyRuntime(value, now);
    expect(a.playbackId).toBe('current'); expect(a.playing).toBeTrue(); expect(a.busyRow).toBe('');
    expect(a.err).toBe('MEDIA_RANGE_FAILED');
    a.applyRuntime(runtime(2, 'finished'), now);
    expect(a.playing).toBeFalse(); expect(a.mediaChangeMessage).toContain('finalizada');
    expect(a.err).toBe('');
    const ended = runtime(3); ended.bot!.status = 'ended'; ended.bot!.resource_released = true;
    a.applyRuntime(ended, now); expect(a.botId).toBe('');
  });

  it('preserves the specific error across freshness checks and clears obsolete playback text', () => {
    a.applyRuntime(runtime(), now); a.busyRow = 'videos/next.mp4';
    a.runtimeReadError({code:'firestore/permission-denied'});
    a.checkRuntimeFreshness(now + 5000);
    expect(a.syncReadErrorCode).toBe('permission-denied');
    expect(a.syncMessage).toContain('Tu usuario no tiene permiso');
    expect(a.mediaChangeMessage).toBe(''); expect(a.busyRow).toBe('');
    expect(a.syncManaged).toBeTrue(); expect(a.syncFresh).toBeFalse();
    a.runtimeReadError({code:'unauthenticated'});
    expect(a.syncMessage).toContain('Vuelve a iniciar sesión');
  });

  it('recovers from a read error on the same document version but rejects older versions', () => {
    a.applyRuntime(runtime(2), now);
    a.runtimeReadError({code:'unavailable'});
    a.applyRuntime(runtime(1), now);
    expect(a.syncFresh).toBeFalse();
    a.applyRuntime(runtime(2), now);
    expect(a.syncFresh).toBeTrue(); expect(a.syncReadErrorCode).toBe('');
    expect(a.syncMessage).toBe(''); expect(a.mediaChangeMessage).toContain('videos/current.mp4');
  });

  it('does not trust an offline agent or a failed listener', () => {
    const value = runtime(); value.agent_online = false;
    a.applyRuntime(value, now); expect(a.syncFresh).toBeFalse();
    a.applyRuntime(runtime(2), now); a.runtimeReadError(); a.checkRuntimeFreshness(now);
    expect(a.syncFresh).toBeFalse();
  });
});
