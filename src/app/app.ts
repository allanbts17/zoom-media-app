import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Meeting, MeetingsService } from './shared/services/meetings.service';
import { BackendService, VideoItem } from './shared/services/backend.service';
import { ZoomService } from './shared/services/zoom.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})

export class App implements OnInit {
  meetings: Meeting[] = [];
  selectedMeetingId = signal<string>('');
  newTitle = '';
  newUrl = '';

  // videos
  loading = true;
  videos: VideoItem[] = [];
  selectedMap: Record<string, boolean> = {};
  playing = false;
  busyRow = '';
  botId = '';

  err = '';
  isUploading = false;

  constructor(
    private backend: BackendService,
    private meetingsService: MeetingsService,
    public zoom: ZoomService
  ) { 


  }

  async ngOnInit() {
    //await this.zoom.init();

    this.meetingsService.meetings$.subscribe({
      next: (list) => {
        this.meetings = list;
        if (!this.selectedMeetingId() && list.length) {
          this.selectedMeetingId.set(list[0].id!);
        }
      },
      error: (e) => (this.err = e?.message ?? 'Error leyendo reuniones'),
    });

    this.backend.listVideos().subscribe({
      next: (list) => { this.videos = list; this.loading = false; },
      error: (e) => { this.err = e?.message ?? 'Error cargando videos'; this.loading = false; }
    });
  }

  meetingSelected(){
    return this.meetings.find(m => m.id === this.selectedMeetingId()) || null;
  }
  toggle(name: string) {
    this.selectedMap[name] = !this.selectedMap[name];
    this.selectedMap = { ...this.selectedMap };
  }

  calculateDuration(v: VideoItem) {
    this.err = '';
    this.busyRow = v.name;
    this.loadDuration(v.publicUrl).then(d => { v.duration = d; this.busyRow = ''; }).catch(_ => this.busyRow = '');
  }


  async addMeeting() {
    this.err = '';
    try {
      await this.meetingsService.addMeeting(this.newTitle, this.newUrl);
      this.newTitle = ''; this.newUrl = '';
    } catch (e: any) {
      this.err = e?.message ?? 'No se pudo añadir la reunión';
    }
  }

  async createBot() {
    this.err = '';
    const meeting = this.meetingSelected();
    if (!meeting?.url) { this.err = 'Selecciona o añade una reunión'; return; }
    try {
      const res = await this.backend.createBot(meeting.url).toPromise();
      this.botId = String(res?.id ?? '');
    } catch (e: any) {
      this.err = e?.message ?? 'No se pudo crear el bot';
    }
  }

  async playSingle(v: VideoItem) {
    if (!this.botId) { this.err = 'Crea el bot primero'; return; }
    try {
      this.busyRow = v.name;
      if (v.duration == null) {
        try { v.duration = await this.loadDuration(v.publicUrl); } catch { }
      }
      await this.backend.outputMedia(this.botId, v.publicUrl).toPromise();
    } catch (e: any) {
      this.err = e?.message ?? 'Error reproduciendo';
    } finally {
      this.busyRow = '';
    }
  }

  async stopNow() {
    if (!this.botId) return;
    try {
      await this.backend.stopMedia(this.botId).toPromise();
    } catch (e: any) {
      this.err = e?.message ?? 'Error deteniendo';
    } finally {
      this.playing = false;
    }
  }

  selectedList(): VideoItem[] {
    return this.videos.filter(v => this.selectedMap[v.name]);
  }

  async playQueue() {
    this.err = '';
    if (!this.botId) { this.err = 'Crea el bot primero'; return; }
    const queue = this.selectedList();
    if (queue.length === 0) { this.err = 'Selecciona uno o más videos'; return; }
    if (this.playing) return;

    this.playing = true;
    try {
      // pre-calc durations
      for (const v of queue) {
        if (v.duration == null) {
          try { v.duration = await this.loadDuration(v.publicUrl); }
          catch { v.duration = 0; }
        }
      }

      const bufferMs = 700;
      for (const v of queue) {
        this.busyRow = v.name;
        await this.backend.outputMedia(this.botId, v.publicUrl).toPromise();

        const waitMs = Math.max(1000, Math.floor((v.duration ?? 0) * 1000) + bufferMs);
        await new Promise<void>(res => setTimeout(res, waitMs));

        await this.backend.stopMedia(this.botId).toPromise();
        this.busyRow = '';
      }
    } catch (e: any) {
      this.err = e?.message ?? 'Error en cola';
    } finally {
      this.busyRow = '';
      this.playing = false;
    }
  }

  async shareApp() {
    await this.zoom.shareApp();
  }

  async fileChangeListener(event: any) {
    this.err = '';
    const file: File = event.target.files[0];
    if (!file) return; 
    this.isUploading = true;
    const formData = new FormData();
    formData.append('video', file);
    try {
      console.log('Uploading file:', file.name, file.size, file.type);
      // const result = await this.backend.uploadVideo(formData).toPromise()
      // console.log('Upload result:', result);
      await this.backend.uploadVideoW(file);
    } catch (e: any) {
      console.error('Upload error:', e);
    } finally {
      this.isUploading = false;
    }
  }

  private loadDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      const cleanup = () => { v.src = ''; v.remove(); };
      v.onloadedmetadata = () => {
        const d = v.duration; cleanup();
        isFinite(d) ? resolve(d) : reject(new Error('No duration'));
      };
      v.onerror = () => { cleanup(); reject(new Error('Metadata load error')); };
    });
  }
}
