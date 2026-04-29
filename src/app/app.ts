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
import { Meeting, VideoItem, VideoList, Config } from './shared/interfaces';
import { DurationPipe } from './shared/pipes/duration-pipe';
import { VideoListsService } from './shared/services/video-lists.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, LoadingOverlayComponent,
    CdkDropList, CdkDrag, CdkDragHandle, ConfirmModalComponent, DurationPipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})

export class App implements OnInit {
  meetings: Meeting[] = [];
  private static readonly MEETING_CACHE_KEY = 'selectedMeetingId';
  selectedMeetingId = signal<string>(localStorage.getItem(App.MEETING_CACHE_KEY) ?? '');
  newTitle = '';
  newUrl = '';

  // videos
  loading = true;
  videos: VideoItem[] = [];
  selectedMap: Record<string, boolean> = {};
  playing = false;
  busyRow = '';
  botId = '';

  // Lists and Ordering
  videoLists: VideoList[] = [];
  activeListId = signal<string>('all');
  reorderMode = false;
  globalVideoOrder: string[] = [];
  originalOrderBackup: string[] = [];
  newListTitle = '';

  err = '';
  isUploading = false;

  constructor(
    private backend: BackendService,
    private meetingsService: MeetingsService,
    public zoom: ZoomService,
    private loadingservice: LoadingService,
    public confirmService: ModalService,
    private videoListsService: VideoListsService
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
        this.globalVideoOrder = config?.globalVideoOrder ?? [];
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
        const cached = this.selectedMeetingId();
        const cachedStillValid = cached && list.some(m => m.id === cached);
        if (!cachedStillValid && list.length) {
          this.selectMeeting(list[0].id!);
        }
      },
      error: (e) => (this.err = e?.message ?? 'Error leyendo reuniones'),
    });

    this.videoListsService.lists$.subscribe({
      next: (lists) => this.videoLists = lists,
      error: (e) => this.err = e?.message ?? 'Error leyendo listas'
    });
  }


  get displayedVideos(): VideoItem[] {
    let list: VideoItem[] = [];
    let order: string[] = [];

    if (this.activeListId() === 'all') {
      list = [...this.videos];
      order = this.globalVideoOrder;
    } else {
      const activeList = this.videoLists.find(l => l.id === this.activeListId());
      if (activeList) {
        order = activeList.videoPaths;
        list = this.videos.filter(v => order.includes(v.videoPath));
      } else {
        list = [...this.videos];
      }
    }

    if (order && order.length > 0) {
      list.sort((a, b) => {
        const indexA = order.indexOf(a.videoPath);
        const indexB = order.indexOf(b.videoPath);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }

    return list;
  }

  drop(event: CdkDragDrop<VideoItem[]>) {
    if (!this.reorderMode) return;
    const newDisplayed = [...this.displayedVideos];
    moveItemInArray(newDisplayed, event.previousIndex, event.currentIndex);

    const newOrder = newDisplayed.map(v => v.videoPath);
    if (this.activeListId() === 'all') {
      this.globalVideoOrder = newOrder;
    } else {
      const activeList = this.videoLists.find(l => l.id === this.activeListId());
      if (activeList) activeList.videoPaths = newOrder;
    }
  }

  async toggleReorder() {
    if (this.reorderMode) {
      // Guardar el orden
      this.loadingservice.show();
      try {
        if (this.activeListId() === 'all') {
          await this.backend.setConfig({
            botId: this.botId,
            busyRow: this.busyRow,
            playing: this.playing,
            globalVideoOrder: this.globalVideoOrder
          });
        } else {
          const activeList = this.videoLists.find(l => l.id === this.activeListId());
          if (activeList && activeList.id) {
            await this.videoListsService.updateList(activeList.id, { videoPaths: activeList.videoPaths });
          }
        }
      } catch (e: any) {
        this.err = e?.message ?? 'Error guardando el orden';
      } finally {
        this.loadingservice.hide();
        this.reorderMode = false;
      }
    } else {
      if (this.activeListId() === 'all') {
        this.originalOrderBackup = [...this.globalVideoOrder];
      } else {
        const activeList = this.videoLists.find(l => l.id === this.activeListId());
        this.originalOrderBackup = activeList ? [...activeList.videoPaths] : [];
      }
      this.reorderMode = true;
    }
  }

  cancelReorder() {
    if (this.activeListId() === 'all') {
      this.globalVideoOrder = [...this.originalOrderBackup];
    } else {
      const activeList = this.videoLists.find(l => l.id === this.activeListId());
      if (activeList) activeList.videoPaths = [...this.originalOrderBackup];
    }
    this.reorderMode = false;
  }

  async createNewList() {
    const queue = this.selectedList();
    if (queue.length === 0) return;
    if (!this.newListTitle.trim()) {
      this.err = 'Ingresa un nombre para la nueva lista';
      return;
    }
    this.err = '';
    this.loadingservice.show();
    try {
      const paths = queue.map(v => v.videoPath);
      await this.videoListsService.addList(this.newListTitle, paths);
      this.newListTitle = '';
      this.selectedMap = {}; // clear selection
    } catch (e: any) {
      this.err = e?.message ?? 'Error creando lista';
    } finally {
      this.loadingservice.hide();
    }
  }

  async addSelectedToList(listId: string) {
    const queue = this.selectedList();
    if (queue.length === 0 || !listId) return;

    const targetList = this.videoLists.find(l => l.id === listId);
    if (!targetList || !targetList.id) return;

    this.loadingservice.show();
    try {
      const newPaths = [...targetList.videoPaths];
      queue.forEach(v => {
        if (!newPaths.includes(v.videoPath)) {
          newPaths.push(v.videoPath);
        }
      });
      await this.videoListsService.updateList(targetList.id, { videoPaths: newPaths });
      this.selectedMap = {}; // clear selection
    } catch (e: any) {
      this.err = e?.message ?? 'Error agregando a la lista';
    } finally {
      this.loadingservice.hide();
    }
  }

  async removeSelectedFromCurrentList() {
    if (this.activeListId() === 'all') return;
    const queue = this.selectedList();
    if (queue.length === 0) return;

    const activeList = this.videoLists.find(l => l.id === this.activeListId());
    if (!activeList || !activeList.id) return;

    this.loadingservice.show();
    try {
      const pathsToRemove = queue.map(v => v.videoPath);
      const newPaths = activeList.videoPaths.filter(p => !pathsToRemove.includes(p));
      await this.videoListsService.updateList(activeList.id, { videoPaths: newPaths });
      this.selectedMap = {};
    } catch (e: any) {
      this.err = e?.message ?? 'Error removiendo de la lista';
    } finally {
      this.loadingservice.hide();
    }
  }

  async deleteCurrentList() {
    if (this.activeListId() === 'all') return;

    let confirm = await this.confirmService.confirm('Confirmación', '¿Seguro que quieres borrar la lista actual?');
    if (!confirm) return;

    this.loadingservice.show();
    try {
      await this.videoListsService.deleteList(this.activeListId());
      this.activeListId.set('all');
    } catch (e: any) {
      this.err = e?.message ?? 'Error borrando la lista';
    } finally {
      this.loadingservice.hide();
    }
  }

  updateConfig() {
    return this.backend.setConfig({
      botId: this.botId,
      busyRow: this.busyRow,
      playing: this.playing
    });
  }


  selectMeeting(id: string) {
    this.selectedMeetingId.set(id);
    localStorage.setItem(App.MEETING_CACHE_KEY, id);
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

  /*
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
  */

  async shareApp() {
    await this.zoom.shareApp();
  }

  async removeBot() {
    this.err = '';
    if (!this.botId) { this.err = 'No hay bot para retirar'; return; }
    try {
      await this.backend.removeBot(this.botId).toPromise();
    } catch (e: any) {
      this.err = e?.message ?? 'No se pudo retirar el bot';
    } finally {
      this.botId = '';
      this.updateConfig()
    }
  }

  async fileChangeListener(event: any) {
    this.err = '';
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;
    this.isUploading = true;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Uploading file ${i + 1}/${files.length}:`, file.name, file.size, file.type);
        await this.backend.uploadVideo(file);
      }
    } catch (e: any) {
      console.error('Upload error:', e);
      this.err = e?.message ?? 'Upload error';
    } finally {
      this.isUploading = false;
      event.target.value = '';
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

  isMeetingsCollapsed = signal<boolean>(false);

  toggleMeetings() {
    this.isMeetingsCollapsed.update(v => !v);
  }
}
