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

  uploadVideo(formData: FormData) {
    return this.http.post<VideoItem>('/upload', formData);
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

  async uploadVideoW(file: File) {
  // 1) Pide al backend una URL firmada
  // const qs = new URLSearchParams({
  //   contentType: file.type || "video/mp4",
  //   ext: (file.name.split(".").pop() || "mp4"),
  //   prefix: "videos" // opcional
  // });

  // const resp = await fetch(`/getUploadUrl?` + qs.toString(), { method: "GET", credentials: "include" });
  // const { uploadUrl, objectName, bucket, publicUrl } = await resp.json();
  
  const response = (await this.http.post('/videos/upload-url', { filename: file.name }).toPromise()) as { uploadUrl: string };

  // 2) Sube directo a GCS con PUT
  const put = await fetch(response.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "video/mp4" },
    body: file,
  });

  if (!put.ok) {
    const txt = await put.text();
    throw new Error(`Fallo subiendo a GCS: ${put.status} ${txt}`);
  }
  console.log("Subido a GCS con éxito");

  // 3) (Opcional) Notifica a tu backend que ya está el archivo, guarda metadata en DB, etc.
  //return { bucket, objectName, publicUrl };
}

}
