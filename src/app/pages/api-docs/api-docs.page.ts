import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { defer, finalize, Subscription, switchMap } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';

type Method = 'GET' | 'POST' | 'DELETE';
interface Endpoint {
  id: string; method: Method; path: string; title: string; description: string;
  query?: string; examples?: Record<string, unknown>;
}
interface LabResponse { status: number; statusText: string; body: string; headers: string; ms: number; }
const pretty = (value: unknown) => JSON.stringify(value, null, 2);

@Component({
  selector: 'app-api-docs', imports: [FormsModule, RouterLink],
  templateUrl: './api-docs.page.html', styleUrl: './api-docs.page.css',
})
export class ApiDocsPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private request?: Subscription;
  readonly username = this.auth.username;
  readonly busy = signal(false);
  readonly response = signal<LabResponse | null>(null);
  readonly notice = signal('');
  readonly endpoints: Endpoint[] = [
    { id: 'vm', method: 'GET', path: '/vm', title: 'Estado de la VM', description: 'Consulta Compute Engine, incluso si la VM está apagada. Añade operation=nombre para verificar una orden de arranque o detención.' },
    { id: 'vm-start', method: 'POST', path: '/vm/start', title: 'Encender VM', description: 'Consulta el estado y solicita el arranque si hace falta. RUNNING no implica que el agente esté listo: consulta Disponibilidad del agente.', examples: { 'Sin parámetros': {} } },
    { id: 'vm-stop', method: 'POST', path: '/vm/stop', title: 'Detener VM', description: 'Solicita apagar zoom-bot-vm. Esto desconecta cualquier bot que siga dentro de la reunión.', examples: { 'Sin parámetros': {} } },
    { id: 'live', method: 'GET', path: '/health/live', title: 'Proceso HTTP', description: 'Comprueba el proceso de la API. No confirma que el agente de la VM esté disponible.' },
    { id: 'ready', method: 'GET', path: '/health/ready', title: 'Disponibilidad del agente', description: 'Comprueba si el agente está listo. Con la VM apagada puede responder 503.' },
    { id: 'capacity', method: 'GET', path: '/capacity', title: 'Capacidad', description: 'Consulta la plaza disponible y el estado del agente.' },
    { id: 'list', method: 'GET', path: '/bots', title: 'Listar bots', description: 'Filtra por estado de sesión: status=active devuelve solo activos. Omite status para listar todos; conserva el filtro al usar cursor. Otros estados: accepted, preparing, joining, waiting_room, reconnecting, leaving, ended, failed.', query: 'status=active&limit=10' },
    { id: 'join', method: 'POST', path: '/bots', title: 'Entrar a una reunión', description: 'Crea una sesión sin medios. Un 202 indica aceptación: consulta después la operación.', examples: {
      'Entrar sin límite de duración': { meeting: { number: '123456789', password: '', participant_name: 'VideoBot-Lab' }, options: { waiting_room_timeout_seconds: 180, max_session_seconds: null } },
      'Entrar por tres horas': { meeting: { number: '123456789', password: '', participant_name: 'VideoBot-Lab' }, options: { waiting_room_timeout_seconds: 180, max_session_seconds: 10800 } },
    } },
    { id: 'bot', method: 'GET', path: '/bots/{bot_id}', title: 'Estado del bot', description: 'Consulta conexión, reproducción y operación pendiente.' },
    { id: 'leave', method: 'DELETE', path: '/bots/{bot_id}', title: 'Salir de la reunión', description: 'Retira el bot y libera la plaza al completar la limpieza.' },
    { id: 'events', method: 'GET', path: '/bots/{bot_id}/events', title: 'Eventos del bot', description: 'Consulta eventos. Puedes añadir after_sequence, limit o cursor.', query: 'limit=20' },
    { id: 'operation', method: 'GET', path: '/operations/{operation_id}', title: 'Consultar operación', description: 'Comprueba si una orden terminó en succeeded, failed o cancelled.' },
    { id: 'play', method: 'POST', path: '/bots/{bot_id}/play', title: 'Reproducir medios', description: 'Inicia video, audio o imagen en un bot conectado. Edita el enlace público de Storage.', examples: {
      Video: { media: { type: 'video', url: 'https://storage.googleapis.com/zoom-app-dev.firebasestorage.app/videos/video.mp4', audio_enabled: true } },
      Audio: { media: { type: 'audio', url: 'https://storage.googleapis.com/zoom-app-dev.firebasestorage.app/audios/audio.mp3' } },
      Imagen: { media: { type: 'image', url: 'https://storage.googleapis.com/zoom-app-dev.firebasestorage.app/images/imagen.jpg' } },
    } },
    ...(['pause', 'resume', 'stop'] as const).map((action, index): Endpoint => ({
      id: action, method: 'POST', path: `/bots/{bot_id}/${action}`,
      title: ['Pausar', 'Reanudar', 'Detener reproducción'][index],
      description: 'Controla la reproducción actual. Stop conserva al bot en la reunión.',
      examples: { 'Reproducción actual': {}, 'Con playback_id': { playback_id: '' } },
    })),
  ];
  selected = this.endpoints[0];
  botId = '';
  operationId = '';
  playbackId = '';
  query = '';
  body = '';
  extraHeaders = '{}';
  idempotencyKey: string = crypto.randomUUID();
  example = '';

  constructor() {
    effect(() => {
      if (!this.auth.user()) {
        this.cancel();
        this.response.set(null);
        this.body = '';
        this.extraHeaders = '{}';
        void this.router.navigateByUrl('/', { replaceUrl: true });
      }
    });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  get needsBot(): boolean { return this.selected.path.includes('{bot_id}'); }
  get needsOperation(): boolean { return this.selected.path.includes('{operation_id}'); }
  get mutation(): boolean { return this.selected.method !== 'GET'; }
  get examples(): string[] { return Object.keys(this.selected.examples ?? {}); }
  get url(): string {
    const path = this.selected.path.replace('{bot_id}', encodeURIComponent(this.botId.trim()))
      .replace('{operation_id}', encodeURIComponent(this.operationId.trim()));
    const query = this.query.trim().replace(/^\?/, '');
    return '/zoom-bot' + path + (query ? '?' + query : '');
  }

  select(endpoint: Endpoint): void {
    if (this.busy()) return;
    this.selected = endpoint;
    this.query = endpoint.query ?? '';
    this.example = Object.keys(endpoint.examples ?? {})[0] ?? '';
    this.loadExample();
    this.newKey();
    this.notice.set('');
    this.response.set(null);
  }

  loadExample(): void {
    const value = this.selected.examples?.[this.example];
    this.body = value === undefined ? '' : pretty(value);
    if (this.example === 'Con playback_id') this.body = pretty({ playback_id: this.playbackId });
  }
  newKey(): void { this.idempotencyKey = crypto.randomUUID(); }
  formatBody(): void {
    try { this.body = pretty(JSON.parse(this.body)); this.notice.set(''); }
    catch { this.notice.set('El cuerpo no es JSON válido. Puedes enviarlo así para probar la validación del backend.'); }
  }
  clearResponse(): void { this.response.set(null); this.notice.set(''); }
  cancel(): void {
    if (!this.busy()) return;
    this.request?.unsubscribe();
    this.busy.set(false);
    this.notice.set('Espera cancelada en este navegador. Una orden ya recibida por el backend puede seguir ejecutándose.');
  }

  execute(): void {
    if (this.busy()) return;
    this.notice.set('');
    if ((this.needsBot && !this.botId.trim()) || (this.needsOperation && !this.operationId.trim())) {
      this.notice.set('Completa el identificador de la ruta.'); return;
    }
    let headers = new HttpHeaders();
    try {
      const custom: unknown = JSON.parse(this.extraHeaders);
      if (!custom || Array.isArray(custom) || typeof custom !== 'object') throw new Error();
      for (const [name, value] of Object.entries(custom)) {
        if (typeof value !== 'string' || /[\r\n]/.test(name + value)) throw new Error();
        if (['authorization', 'idempotency-key', 'cookie', 'host'].includes(name.toLowerCase())) {
          this.notice.set('Authorization se obtiene de tu sesión. Usa el campo propio para Idempotency-Key.'); return;
        }
        headers = headers.set(name, value);
      }
    } catch { this.notice.set('Los headers adicionales deben ser un objeto JSON con valores de texto.'); return; }
    if (this.mutation && this.idempotencyKey) headers = headers.set('Idempotency-Key', this.idempotencyKey);
    if (this.selected.method === 'POST' && !headers.has('Content-Type')) headers = headers.set('Content-Type', 'application/json');
    const method = this.selected.method;
    const url = this.url;
    const body = method === 'POST' ? this.body : undefined;
    const started = performance.now();
    this.busy.set(true);
    this.response.set(null);
    this.request = defer(async () => {
      const user = await this.auth.waitForSession();
      if (!user) throw new Error('Sesión cerrada. Vuelve a iniciar sesión con Google.');
      return user.getIdToken();
    }).pipe(
      switchMap(token => this.http.request(method, url, {
        body, headers: headers.set('Authorization', `Bearer ${token}`), observe: 'response', responseType: 'text',
      })),
      finalize(() => this.busy.set(false)),
    ).subscribe({
      next: reply => {
        this.showResponse(reply.status, reply.statusText, reply.body ?? '', reply.headers, started);
        this.captureIds(reply.body ?? '');
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          const value = typeof error.error === 'string' ? error.error : pretty(error.error ?? error.message);
          this.showResponse(error.status, error.statusText, value, error.headers, started);
          if (error.status === 0) this.notice.set('No se recibió respuesta HTTP. Revisa conexión, proxy y consola del navegador.');
        } else this.notice.set(error instanceof Error ? error.message : 'No se pudo obtener la sesión de Firebase.');
      },
    });
  }

  private showResponse(status: number, statusText: string, body: string, headers: HttpHeaders, started: number): void {
    try { body = pretty(JSON.parse(body)); } catch { /* Keep non-JSON responses verbatim. */ }
    this.response.set({ status, statusText, body, headers: headers.keys().map(name => `${name}: ${headers.getAll(name)?.join(', ')}`).join('\n'), ms: Math.round(performance.now() - started) });
  }
  private captureIds(body: string): void {
    try {
      const value = JSON.parse(body);
      if (!value || typeof value !== 'object') return;
      if (typeof value.bot_id === 'string') this.botId = value.bot_id;
      if (typeof value.operation_id === 'string') this.operationId = value.operation_id;
      if (typeof value.playback_id === 'string') this.playbackId = value.playback_id;
    } catch { /* Raw response remains visible. */ }
  }
}
