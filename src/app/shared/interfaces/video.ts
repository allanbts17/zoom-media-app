/** Document stored in the videos collection. */
export interface VideoItem {
  videoPath: string;
  videoUrl: string;
  thumbnailPath: string;
  thumbnailUrl: string;
  duration: number;
}

export interface VideoList {
  id?: string;
  name: string;
  videoPaths: string[];
  audioPaths?: string[];
  docPaths?: string[];
  createdAt?: any;
}
