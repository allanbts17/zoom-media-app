export interface Config {
  botId?: string;
  busyRow?: string;
  playing: boolean;
  globalVideoOrder?: string[];
  botMaxSessionSeconds?: number;
  botWaitingRoomTimeoutSeconds?: number;
}
