import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoadingService } from './loading.service';
import { Firestore, CollectionReference, collection, collectionData, setDoc, doc, docData, DocumentData } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { Config, VideoItem, DriveFile } from '../interfaces';

@Injectable({
  providedIn: 'root',
})

export class BackendService {
  private firestore = inject(Firestore);
  videos$: Observable<VideoItem[]>;
  videosCollection: CollectionReference;
  dataCollection: CollectionReference;
  private configRef = doc(this.firestore, 'data/config');
  private subscription?: Subscription;
  configData$:  Observable<Config | undefined>

  constructor(private http: HttpClient, private loading: LoadingService) {
    this.videosCollection = collection(this.firestore, 'videos');
    this.videos$ = collectionData(this.videosCollection) as Observable<VideoItem[]>;
    this.dataCollection = collection(this.firestore, 'data');
    this.configData$ = docData(this.configRef) as Observable<Config | undefined>;

    // .subscribe(data => {
    //   console.log('Documento actualizado:', data);
    // });
  }

  setConfig(config: Config) {
    return setDoc(this.configRef, config);
  }

  listVideos() {
    return this.http.get<VideoItem[]>('/videos');
  }

  async deleteVideo(item: VideoItem) {
    return this.http.post(`/videos/delete`, { videoData: item }).toPromise();
  }

  createBot(meetingUrl: string, botName = 'Zoom Media Bot') {
    return this.http.post<{ id: string }>('/recall/create-bot', {
      meeting_url: meetingUrl,
      bot_name: botName,
    });
  }

  removeBot(botId: string) {
    return this.http.post<{ id: string }>('/recall/remove-bot', {
      bot_id: botId
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

  listDriveFiles() {
    return this.http.get<{ files: DriveFile[] }>('/drive/files');
  }

  importDriveFile(fileId: string, fileName: string) {
    return this.http.post<{ gcsPath: string }>('/drive/import', { fileId, fileName });
  }

}
