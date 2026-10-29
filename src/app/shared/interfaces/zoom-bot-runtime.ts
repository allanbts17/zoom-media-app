import { ZoomBot } from './zoom-bot';
export interface ZoomBotRuntime {
  schema_version: 1;
  publisher_id: string;
  sequence: number;
  observed_at: number;
  expires_at: number;
  agent_online: boolean;
  bot: Pick<ZoomBot, 'bot_id' | 'status' | 'playback' | 'resource_released' | 'pending_operation_id' | 'last_error'> | null;
  media_path: string | null;
  preparation: (NonNullable<ZoomBot['preparation']> & {media_path: string | null}) | null;
  operation: {id: string; command: string; status: string; created: number} | null;
}
