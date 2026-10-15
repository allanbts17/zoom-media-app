export type VideoItem = {
  videoPath: string;
  thumbnailPath: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
};

export interface VideoList {
  id?: string;
  name: string;
  videoPaths: string[];
  createdAt?: any;
}
