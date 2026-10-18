import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoadingService } from './loading.service';
import { Firestore, CollectionReference, collection, collectionData, setDoc, doc, docData, DocumentData } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { Config, VideoItem, DriveFile, ZoomBotJoinRequest, ZoomBotMedia } from '../interfaces';
import { ZoomBotService } from './zoom-bot.service';

@Injectable({
  providedIn: 'root',
})

export class BackendService {
  private firestore = inject(Firestore);
  private zoom = inject(ZoomBotService);
  videos$: Observable<VideoItem[]>;
  videosCollection: CollectionReference;
  dataCollection: CollectionReference;
  private configRef = doc(this.firestore, 'data/config');
  private subscription?: Subscription;
  configData$: Observable<Config | undefined>

  constructor(
    private http: HttpClient,
    private loading: LoadingService,
    //private zoom: ZoomBotService,
  ) {
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

  createBot(
    meetingNumber: string,
    meetingPassword?: string,
    botName = 'Zoom Media Bot',
    options?: ZoomBotJoinRequest['options']
  ) {
    const joinRequest: ZoomBotJoinRequest = {
      meeting: { number: meetingNumber, password: meetingPassword, participant_name: botName },
      options
    }
    return this.zoom.joinBot(joinRequest)
    //return this.http.post<{ id: string }>('/recall/create-bot', joinRequest);
  }

  removeBot(botId: string) {
    return this.zoom.leaveBot(botId)
    // return this.http.post<{ id: string }>('/recall/remove-bot', {
    //   bot_id: botId
    // });
  }

  play(botId: string, type: ZoomBotMedia['type'], url: string, imageDuration: number = 60) {
    if (type == 'video') return this.zoom.play(botId, { type, url, audio_enabled: true })
    if (type == 'audio') return this.zoom.play(botId, { type, url })
    else return this.zoom.play(botId, { type, url, duration_seconds: imageDuration })
  }

  pause(botId: string, playbackId: string) {
    return this.zoom.pause(botId, playbackId)
  }

  resume(botId: string, playbackId: string) {
    return this.zoom.resume(botId, playbackId)
  }

  stop(botId: string, playbackId: string) {
    return this.zoom.stop(botId, playbackId)
  }

  // stopMedia(botId: string) {
  //   return this.http.delete('/recall/output-media', { params: { bot_id: botId } });
  // }

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
