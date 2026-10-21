import { ZoomBotAction } from "./zoom-bot";

export interface Config {
  botId?: string;
  busyRow?: string;
  playing: boolean;
  globalVideoOrder?: string[];
  globalAudioOrder?: string[];
  botMaxSessionSeconds?: number;
  botWaitingRoomTimeoutSeconds?: number;
  playbackId?: string;
  botAction?: ZoomBotAction | '';
}
