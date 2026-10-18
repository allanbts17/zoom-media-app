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

export interface ZoomVmState {
  name: string;
  status: string;
  operation?: { name: string; status: string; error: string | null };
  no_op?: boolean;
}
