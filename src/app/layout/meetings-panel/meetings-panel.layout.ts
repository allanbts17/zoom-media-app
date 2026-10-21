import { Component, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { firstValueFrom, timer, exhaustMap, filter, take, timeout, Subscription } from 'rxjs';
import { ZoomBotService } from '../../shared/services/zoom-bot.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeStateService } from '../../pages/home/home-state.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeetingsService } from '../../shared/services/meetings.service';
import { BackendService } from '../../shared/services/backend.service';
import { ModalService } from '../../shared/services/modal.service';
import { Meeting, ZoomBotJoinRequest, ZoomBotList } from '../../shared/interfaces';

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
  private readonly modalService = inject(ModalService);
  private readonly zoom = inject(ZoomBotService);
  readonly vmStatus = signal('UNKNOWN');
  readonly initialBots = signal<ZoomBotList | null>(null);
  readonly vmBusy = signal(false);
  readonly agentReady = signal(false);
  readonly botConnected = signal(false);
  readonly botAction = signal<'join' | 'leave' | null>(null);
  readonly controlMessage = signal('');
  readonly controlError = signal(false);
  private messageTimer?: ReturnType<typeof setTimeout>;
  private vmTimer?: ReturnType<typeof setTimeout>;
  private vmRequest?: Subscription;
  private vmGeneration = 0;
  private destroyed = false;
  private observedBotId = '';

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.messageTimer);
      clearTimeout(this.vmTimer);
      this.vmRequest?.unsubscribe();
    });
  }

  get vmButtonLabel(): string {
    if (this.vmBusy()) return this.vmStatus() === 'STOPPING' ? 'Deteniendo VM' : 'Comprobando VM';
    if (this.vmStatus() === 'RUNNING') return 'Detener VM';
    if (this.vmStatus() === 'TERMINATED') return 'Encender VM';
    return 'Actualizar estado de VM';
  }

  private message(text: string, error = false, temporary = false): void {
    if (this.destroyed) return;
    clearTimeout(this.messageTimer);
    this.controlMessage.set(text);
    this.controlError.set(error);
    if (temporary) this.messageTimer = setTimeout(() => this.controlMessage.set(''), error ? 12000 : 6000);
  }

  private errorCode(error: unknown): string {
    const reply = error as { error?: { error?: { code?: string } }; message?: string };
    return reply.error?.error?.code || reply.message || 'UNKNOWN_ERROR';
  }

  refreshVm(initial = false): void {
    if (this.vmBusy() || this.destroyed) return;
    const generation = ++this.vmGeneration;
    this.vmBusy.set(true);
    this.vmRequest = this.zoom.getVm().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: state => {
        if (generation !== this.vmGeneration) return;
        this.vmStatus.set(state.status);
        this.vmBusy.set(false);
        this.agentReady.set(false);
        if (state.status === 'RUNNING') {
          if (initial) this.loadInitialBots();
          this.watchVm('RUNNING', undefined, false);
        }
        else if (['PROVISIONING', 'STAGING'].includes(state.status)) this.watchVm('RUNNING');
        else if (state.status === 'STOPPING') this.watchVm('TERMINATED');
      },
      error: error => {
        this.vmBusy.set(false);
        this.vmStatus.set('UNKNOWN');
        this.message('No se pudo consultar la VM: ' + this.errorCode(error), true, true);
      },
    });
  }

  private loadInitialBots(): void {
    this.zoom.listBots({ status: 'active' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: bots => {
        this.initialBots.set(bots);
        const bot = bots.items[0];
        if (bot) {
          this.state.botId = bot.bot_id;
          this.botConnected.set(true);
          this.state.updateConfig();
        }
      },
      error: error => this.message('No se pudo listar los bots: ' + this.errorCode(error), true, true),
    });
  }

  toggleVm(): void {
    if (this.vmBusy() || this.botAction()) return;
    const action = this.vmStatus() === 'RUNNING' ? 'stop' : this.vmStatus() === 'TERMINATED' ? 'start' : null;
    if (!action) { this.refreshVm(); return; }
    this.vmBusy.set(true);
    this.agentReady.set(false);
    this.message(action === 'start' ? 'Encendiendo la VM…' : 'Deteniendo la VM…');
    const request = action === 'start' ? this.zoom.startVm() : this.zoom.stopVm();
    this.vmRequest = request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: state => {
        this.vmStatus.set(state.status);
        if (state.operation?.error) { this.vmBusy.set(false); this.message('La VM no completó la orden: ' + state.operation.error, true, true); return; }
        this.watchVm(action === 'start' ? 'RUNNING' : 'TERMINATED', state.operation?.name);
      },
      error: error => { this.vmBusy.set(false); this.message('No se pudo controlar la VM: ' + this.errorCode(error), true, true); },
    });
  }

  private watchVm(target: 'RUNNING' | 'TERMINATED', operation?: string, announce = true): void {
    const generation = ++this.vmGeneration;
    const deadline = Date.now() + 5 * 60 * 1000;
    this.vmBusy.set(true);
    const poll = async (): Promise<void> => {
      if (this.destroyed || generation !== this.vmGeneration) return;
      try {
        const vm = await firstValueFrom(this.zoom.getVm(operation).pipe(takeUntilDestroyed(this.destroyRef)));
        if (this.destroyed || generation !== this.vmGeneration) return;
        this.vmStatus.set(vm.status);
        if (vm.operation?.error) throw new Error(vm.operation.error);
        if (vm.operation?.status === 'DONE' && vm.status !== target) throw new Error('VM_STATE_CONFLICT');
        if (vm.status === target) {
          if (target === 'TERMINATED') {
            this.agentReady.set(false);
            this.clearBotState();
            this.vmBusy.set(false);
            this.message('VM detenida.', false, true);
            return;
          }
          try {
            const readiness = await firstValueFrom(this.zoom.getReadiness().pipe(takeUntilDestroyed(this.destroyRef)));
            if (this.destroyed || generation !== this.vmGeneration) return;
            if (readiness.status === 'ready') {
              this.agentReady.set(true);
              this.vmBusy.set(false);
              if (announce) this.message('VM encendida y agente listo.', false, true);
              return;
            }
          } catch { /* A running VM may still be starting its agent. */ }
          if (announce) this.message('VM encendida; esperando al agente…');
        } else if (announce) this.message(target === 'RUNNING' ? 'Encendiendo la VM…' : 'Deteniendo la VM…');
        if (Date.now() >= deadline) throw new Error('No se confirmó el estado final. Actualiza el estado de la VM.');
        if (!this.destroyed && generation === this.vmGeneration) this.vmTimer = setTimeout(() => void poll(), 3000);
      } catch (error) {
        if (this.destroyed || generation !== this.vmGeneration) return;
        this.vmBusy.set(false);
        this.message('No se pudo confirmar la VM: ' + this.errorCode(error), true, true);
      }
    };
    void poll();
  }

  private clearBotState(): void {
    this.state.botId = '';
    this.state.playing = false;
    this.state.busyRow = '';
    this.state.playbackId = '';
    this.state.botAction = '';
    this.botConnected.set(false);
    this.state.updateConfig();
  }

  private async waitOperation(id: string): Promise<void> {
    const result = await firstValueFrom(timer(0, 2000).pipe(
      exhaustMap(() => this.zoom.getOperation(id)),
      filter(operation => ['succeeded', 'failed', 'cancelled'].includes(operation.status)),
      take(1), timeout(35 * 60 * 1000), takeUntilDestroyed(this.destroyRef),
    ));
    if (result.status !== 'succeeded') throw new Error(result.error?.code || result.status.toUpperCase());
  }

  readonly isDeletingMeeting = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  readonly driveRequested = output<void>();

  meetings: Meeting[] = [];
  static readonly MEETING_CACHE_KEY = 'selectedMeetingId';
  selectedMeetingId = signal<string>(localStorage.getItem(MeetingsPanelLayout.MEETING_CACHE_KEY) ?? '');
  newTitle = '';
  newMeetingUrl = '';
  newMeetingPassword = '';
  isUploading = false;
  isMeetingsCollapsed = signal<boolean>(false);

  selectMeeting(id: string) {
    this.selectedMeetingId.set(id);
    localStorage.setItem(MeetingsPanelLayout.MEETING_CACHE_KEY, id);
  }

  meetingSelected() {
    return this.meetings.find(m => m.id === this.selectedMeetingId()) || null;
  }

  async addMeeting(dialog?: HTMLDialogElement) {
    this.state.err = '';
    try {
      this.newMeetingUrl = this.meetingsService.convertUrl(this.newMeetingUrl)
      await this.meetingsService.addMeeting(this.newTitle, this.newMeetingUrl, this.newMeetingPassword);
      this.newTitle = ''; this.newMeetingPassword = ''; this.newMeetingUrl = '';
      dialog?.close();
    } catch (e: any) {
      this.state.err = e?.message ?? 'No se pudo añadir la reunión';
    }
  }

  async deleteMeeting() {
    const meeting = this.meetingSelected();
    if (!meeting?.id || this.isDeletingMeeting()) return;
    this.isDeletingMeeting.set(true);
    this.state.err = '';
    try {
      const confirmed = await this.modalService.confirm(
        'Eliminar reunión',
        '¿Deseas borrar la reunión “' + (meeting.title?.trim() || meeting.number) + '”?'
      );
      if (!confirmed) return;
      await this.meetingsService.deleteMeeting(meeting.id);
    } catch (e: any) {
      this.state.err = e?.message ?? 'No se pudo eliminar la reunión';
    } finally {
      this.isDeletingMeeting.set(false);
    }
  }

  async createBot() {
    if (this.botAction() || this.vmBusy()) return;
    this.state.err = '';
    const meeting = this.meetingSelected();
    if (!meeting?.number) { this.message('Selecciona o añade una reunión.', true, true); return; }
    if (!this.agentReady()) { this.message('Enciende la VM y espera a que el agente esté listo.', true, true); return; }
    this.botAction.set('join');
    this.botConnected.set(false);
    this.message('Conectando el bot a Zoom…');
    try {
      const options: ZoomBotJoinRequest['options'] = {
        waiting_room_timeout_seconds: this.state.botWaitingRoomTimeoutSeconds,
        max_session_seconds: this.state.botMaxSessionSeconds,
      };
      const ticket = await firstValueFrom(this.backend.createBot(meeting.number, meeting.password || undefined, undefined, options)
        .pipe(takeUntilDestroyed(this.destroyRef)));
      this.state.botId = ticket.bot_id;
      this.state.updateConfig();
      await this.waitOperation(ticket.operation_id);
      if (this.destroyed) return;
      this.botConnected.set(true);
      this.message('El bot se unió a la reunión.', false, true);
    } catch (error) {
      if (this.destroyed) return;
      this.message('No se pudo unir el bot: ' + this.errorCode(error), true, true);
      if (this.state.botId) {
        try {
          const bot = await firstValueFrom(this.zoom.getBot(this.state.botId).pipe(takeUntilDestroyed(this.destroyRef)));
          if (bot.resource_released) this.clearBotState();
        } catch { /* Keep the ID when cleanup cannot be confirmed. */ }
      }
    } finally { if (!this.destroyed) this.botAction.set(null); }
  }

  async removeBot() {
    if (!this.state.botId || this.botAction() || this.vmBusy()) return;
    this.botAction.set('leave');
    this.message('Retirando el bot de Zoom…');
    try {
      const ticket = await firstValueFrom(this.backend.removeBot(this.state.botId).pipe(takeUntilDestroyed(this.destroyRef)));
      await this.waitOperation(ticket.operation_id);
      if (this.destroyed) return;
      this.clearBotState();
      this.message('El bot salió de la reunión.', false, true);
    } catch (error) {
      this.message('No se pudo retirar el bot: ' + this.errorCode(error), true, true);
    } finally { if (!this.destroyed) this.botAction.set(null); }
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
    this.refreshVm(true);
    this.meetingsService.meetings$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.meetings = list;
        const cached = this.selectedMeetingId();
        if (!list.some(meeting => meeting.id === cached)) {
          this.selectMeeting(list[0]?.id ?? '');
        }
      },
      error: error => this.state.err = error?.message ?? 'Error leyendo reuniones',
    });
  }

  ngDoCheck(): void {
    const id = this.state.botId;
    if (!id) { this.observedBotId = ''; this.botConnected.set(false); return; }
    if (!this.agentReady() || this.botAction() || id === this.observedBotId) return;
    this.observedBotId = id;
    this.zoom.getBot(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: bot => {
        if (this.state.botId !== id || this.botAction()) return;
        this.botConnected.set(bot.status === 'active');
        if (bot.resource_released) this.clearBotState();
      },
      error: () => this.botConnected.set(false),
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
