import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoadingService } from './loading.service';
import { Firestore, CollectionReference, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export type VideoItem = {
  videoPath: string;
  thumbnailPath: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
};

@Injectable({
  providedIn: 'root',
})

export class BackendService {
  private firestore = inject(Firestore);
  videos$: Observable<VideoItem[]>;
  videosCollection: CollectionReference;

  constructor(private http: HttpClient, private loading: LoadingService) {
    this.videosCollection = collection(this.firestore, 'videos');
    this.videos$ = collectionData(this.videosCollection) as Observable<VideoItem[]>;
  }

  listVideos() {
    return this.http.get<VideoItem[]>('/videos');
  }

  async deleteVideo(filename: string) {
    return this.http.delete(`/videos/${filename}`).toPromise();
  }

  createBot(meetingUrl: string, botName = 'MediaBot') {
    return this.http.post<{ id: string }>('/recall/create-bot', {
      meeting_url: meetingUrl,
      bot_name: botName,
    });
  }

  outputMedia(botId: string, url: string) {
    return this.http.post('/recall/output-media', { bot_id: botId, url });
  }

  stopMedia(botId: string) {
    return this.http.delete('/recall/output-media', { params: { bot_id: botId } });
  }

  async uploadVideo(file: File) {
  const response = (await this.http.post('/videos/upload-url', { filename: file.name }).toPromise()) as { uploadUrl: string };

  const put = await fetch(response.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "video/mp4" },
    body: file,
  });

  if (!put.ok) {
    const txt = await put.text();
    throw new Error(`Fallo subiendo a GCS: ${put.status} ${txt}`);
  }
}

}
