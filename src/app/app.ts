import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingsService } from './shared/services/meetings.service';
import { BackendService } from './shared/services/backend.service';
import { ZoomService } from './shared/services/zoom.service';
import { LoadingOverlayComponent } from './shared/components/loading-overlay/loading-overlay.component';
import { LoadingService } from './shared/services/loading.service';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, CdkDragHandle } from '@angular/cdk/drag-drop';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { ModalService } from './shared/services/modal.service';
import { Meeting, VideoItem } from './shared/interfaces';
import { DurationPipe } from './shared/pipes/duration-pipe';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, LoadingOverlayComponent,
    CdkDropList, CdkDrag, CdkDragHandle, ConfirmModalComponent, DurationPipe],
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
    public zoom: ZoomService,
    private loadingservice: LoadingService,
    public confirmService: ModalService
  ) {

    backend.videos$.subscribe({
      next: (list) => { this.videos = list; this.loading = false; console.log(this.videos) },
      error: (e) => { this.err = e?.message ?? 'Error cargando videos'; this.loading = false; }
    });
    backend.configData$.subscribe({
      next: (config) => {
        this.botId = config?.botId ?? '';
        this.busyRow = config?.busyRow ?? '';
        this.playing = config?.playing ?? false;
        console.log('Config loaded:', config);
      },
      error: (e) => { this.err = e?.message ?? 'Error cargando configuración'; }
    });
  }

  async ngOnInit() {
    //this.loadingservice.show();
    this.meetingsService.meetings$.subscribe({
      next: (list) => {
        this.meetings = list;
        if (!this.selectedMeetingId() && list.length) {
          this.selectedMeetingId.set(list[0].id!);
        }
      },
      error: (e) => (this.err = e?.message ?? 'Error leyendo reuniones'),
    });
  }


  drop(event: CdkDragDrop<VideoItem[]>) {
    moveItemInArray(this.videos, event.previousIndex, event.currentIndex);
  }

  updateConfig() {
    return this.backend.setConfig({
      botId: this.botId,
      busyRow: this.busyRow,
      playing: this.playing
    });
  }


  meetingSelected() {
    return this.meetings.find(m => m.id === this.selectedMeetingId()) || null;
  }
  toggle(name: string) {
    this.selectedMap[name] = !this.selectedMap[name];
    this.selectedMap = { ...this.selectedMap };
  }

  // calculateDuration(v: VideoItem) {
  //   this.err = '';
  //   this.busyRow = v.name;
  //   this.loadDuration(v.publicUrl).then(d => { v.duration = d; this.busyRow = ''; }).catch(_ => this.busyRow = '');
  // }

  getName(path: string): string {
    const parts = path.split('/');
    return parts[1];
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
      this.updateConfig()
    } catch (e: any) {
      this.err = e?.message ?? 'No se pudo crear el bot';
    }
  }

  async playSingle(v: VideoItem) {
    if (!this.botId) { this.err = 'Crea el bot primero'; return; }
    try {
      this.busyRow = v.videoPath;
      await this.updateConfig()
      if (v.duration == null) {
        try { v.duration = await this.loadDuration(v.videoUrl); } catch { }
      }
      await this.backend.outputMedia(this.botId, v.videoUrl).toPromise();
    } catch (e: any) {
      this.err = e?.message ?? 'Error reproduciendo';
    } finally {
      this.busyRow = '';
      this.updateConfig()
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
      this.updateConfig()
    }
  }

  selectedList(): VideoItem[] {
    return this.videos.filter(v => this.selectedMap[v.videoPath]);
  }

  async playQueue() {
    this.err = '';
    if (!this.botId) { this.err = 'Crea el bot primero'; return; }
    const queue = this.selectedList();
    if (queue.length === 0) { this.err = 'Selecciona uno o más videos'; return; }
    if (this.playing) return;

    this.playing = true;
    this.updateConfig()
    try {
      // pre-calc durations
      for (const v of queue) {
        if (v.duration == null) {
          try { v.duration = await this.loadDuration(v.videoUrl); }
          catch { v.duration = 0; }
        }
      }

      const bufferMs = 700;
      for (const v of queue) {
        this.busyRow = v.videoPath;
        await this.updateConfig()
        await this.backend.outputMedia(this.botId, v.videoUrl).toPromise();

        const waitMs = Math.max(1000, Math.floor((v.duration ?? 0) * 1000) + bufferMs);
        await new Promise<void>(res => setTimeout(res, waitMs));

        await this.backend.stopMedia(this.botId).toPromise();
        this.busyRow = '';
        await this.updateConfig()
      }
    } catch (e: any) {
      this.err = e?.message ?? 'Error en cola';
    } finally {
      this.busyRow = '';
      this.playing = false;
      this.updateConfig()
    }
  }

  async shareApp() {
    await this.zoom.shareApp();
  }

  async removeBot() {
    this.err = '';
    if (!this.botId) { this.err = 'No hay bot para retirar'; return; }
    try {
      this.botId = '';
      this.updateConfig()
      await this.backend.removeBot(this.botId).toPromise();
    } catch (e: any) {
      this.err = e?.message ?? 'No se pudo retirar el bot';
    }
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
      await this.backend.uploadVideo(file);
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

  async deletedSelectedVideos() {

    let confirm = await this.confirmService.confirm('Confirmación', '¿Seguro que quieres borrar?')
    if (!confirm) return;

    const selected = this.selectedList()
    console.log('Delete selected videos:', selected);
    this.loadingservice.show();
    for (const v of selected) {
      await this.backend.deleteVideo(v)
    }
    this.loadingservice.hide();
  }

  toogleContainer() {
    document.getElementById('meetingsContainer')?.classList.toggle('collapsed');
  }
}
