import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type VideoItem = {
  name: string;
  publicUrl: string;
  size: number;
  updated?: string;
  duration?: number;
};

@Injectable({
  providedIn: 'root',
})
export class BackendService {
  // Usamos rutas relativas: Firebase Hosting hará rewrites a Functions
  constructor(private http: HttpClient) {}

  listVideos() {
    return this.http.get<VideoItem[]>('/videos');
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
}
