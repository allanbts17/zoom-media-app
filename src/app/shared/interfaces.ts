export type VideoItem = {
  videoPath: string;
  thumbnailPath: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
};

export interface Meeting {
  id?: string;
  title?: string | null;
  url: string;
  createdAt?: any;
}

export interface VideoList {
  id?: string;
  name: string;
  videoPaths: string[];
  createdAt?: any;
}

export interface Config {
  botId?: string;
  busyRow?: string;
  playing: boolean;
  globalVideoOrder?: string[];
}