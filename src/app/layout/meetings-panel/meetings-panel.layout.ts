import { Component, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeStateService } from '../../pages/home/home-state.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeetingsService } from '../../shared/services/meetings.service';
import { BackendService } from '../../shared/services/backend.service';
import { Meeting } from '../../interfaces';

/** Zoom meeting selection, bot controls, add meeting and add videos (local / Drive search). */
@Component({
  selector: 'app-meetings-panel',
  imports: [CommonModule, FormsModule],
  templateUrl: './meetings-panel.layout.html',
  styleUrl: './meetings-panel.layout.css'
})
export class MeetingsPanelLayout implements OnInit {
  readonly state = inject(HomeStateService);
  private readonly backend = inject(BackendService);
  private readonly meetingsService = inject(MeetingsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly driveRequested = output<void>();

  meetings: Meeting[] = [];
  static readonly MEETING_CACHE_KEY = 'selectedMeetingId';
  selectedMeetingId = signal<string>(localStorage.getItem(MeetingsPanelLayout.MEETING_CACHE_KEY) ?? '');
  newTitle = '';
  newUrl = '';
  isUploading = false;
  isMeetingsCollapsed = signal<boolean>(false);

  selectMeeting(id: string) {
    this.selectedMeetingId.set(id);
    localStorage.setItem(MeetingsPanelLayout.MEETING_CACHE_KEY, id);
  }

  meetingSelected() {
    return this.meetings.find(m => m.id === this.selectedMeetingId()) || null;
  }

  async addMeeting() {
    this.state.err = '';
    try {
      await this.meetingsService.addMeeting(this.newTitle, this.newUrl);
      this.newTitle = ''; this.newUrl = '';
    } catch (e: any) {
      this.state.err = e?.message ?? 'No se pudo añadir la reunión';
    }
  }

  async createBot() {
    this.state.err = '';
    const meeting = this.meetingSelected();
    if (!meeting?.url) { this.state.err = 'Selecciona o añade una reunión'; return; }
    try {
      const res = await this.backend.createBot(meeting.url).toPromise();
      this.state.botId = String(res?.id ?? '');
      this.state.updateConfig()
    } catch (e: any) {
      this.state.err = e?.message ?? 'No se pudo crear el bot';
    }
  }

  async removeBot() {
    this.state.err = '';
    if (!this.state.botId) { this.state.err = 'No hay bot para retirar'; return; }
    try {
      await this.backend.removeBot(this.state.botId).toPromise();
    } catch (e: any) {
      this.state.err = e?.message ?? 'No se pudo retirar el bot';
    } finally {
      this.state.botId = '';
      this.state.updateConfig()
    }
  }

  async fileChangeListener(event: any) {
    this.state.err = '';
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
      this.state.err = e?.message ?? 'Upload error';
    } finally {
      this.isUploading = false;
      event.target.value = '';
    }
  }

  toggleMeetings() {
    this.isMeetingsCollapsed.update(v => !v);
  }

  ngOnInit() {
    this.meetingsService.meetings$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.meetings = list;
        const cached = this.selectedMeetingId();
        if (!list.some(meeting => meeting.id === cached) && list.length) {
          this.selectMeeting(list[0].id!);
        }
      },
      error: error => this.state.err = error?.message ?? 'Error leyendo reuniones',
    });
  }

  updateDriveSearch(query: string) {
    this.state.driveSearchQuery.set(query);
    if (query) this.requestDrive();
  }

  requestDrive() {
    this.driveRequested.emit();
  }

}
