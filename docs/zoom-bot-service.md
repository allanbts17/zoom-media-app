# Guía de ZoomBotService

Servicio Angular en `src/app/shared/services/zoom-bot.service.ts`. Sigue los servicios existentes: HttpClient, Observable y rutas relativas. Llama a `/zoom-bot` en nuestro backend Express; el backend llama a la API privada de Cloud Run.

## Configuración

- `backend/.env` tiene `ZOOM_BOT_ALLOWED_UIDS=REPLACE_WITH_FIREBASE_UID_DUMMY`. Sustituye el dummy por el UID real de Firebase Authentication; varios UID se separan con comas. Se añadió `.env.example` sin credenciales reales.
- El dummy no habilita acceso a ningún usuario real: un usuario no incluido recibe 403. Sin la variable, el backend responde 503.
- El frontend debe tener un usuario con sesión Firebase Auth iniciada. Se registró provideAuth en app.config.ts; este servicio no crea una pantalla de login ni inicia sesión por su cuenta.
- El servicio espera a que Auth restaure su sesión y llama a user.getIdToken() en cada petición. Firebase administra su renovación. No se usa aquí el bearer de gcloud ni se almacenan credenciales de Google en el navegador.
- El backend obtiene su ID token de Cloud Run con google-auth-library y su cuenta de servicio. Debe conservar permiso run.invoker.
- Se añadió proxy.dev.json para `/zoom-bot/**` y rewrite de Firebase Hosting a la función api. Reinicia ng serve después de cambiar el proxy. Despliega backend y hosting cuando decidas publicar; no se desplegaron durante esta tarea.

## Métodos y endpoints

Todos devuelven Observable: suscribe o usa firstValueFrom para ejecutar la petición.

| Método Angular | Ruta del backend | Endpoint de la API bot |
|---|---|---|
| getLiveness() | GET /zoom-bot/health/live | GET /health/live |
| getReadiness() | GET /zoom-bot/health/ready | GET /health/ready |
| getCapacity() | GET /zoom-bot/capacity | GET /v1/capacity |
| listBots({ limit, cursor, status }) | GET /zoom-bot/bots | GET /v1/bots |
| joinBot(request, key?) | POST /zoom-bot/bots | POST /v1/bots |
| getBot(botId) | GET /zoom-bot/bots/:bot_id | GET /v1/bots/:bot_id |
| leaveBot(botId, key?) | DELETE /zoom-bot/bots/:bot_id | DELETE /v1/bots/:bot_id |
| getEvents(botId, { after_sequence, limit }) | GET /zoom-bot/bots/:bot_id/events | GET /v1/bots/:bot_id/events |
| getOperation(operationId) | GET /zoom-bot/operations/:operation_id | GET /v1/operations/:operation_id |
| play(botId, media, key?) | POST /zoom-bot/bots/:bot_id/play | POST /v1/bots/:bot_id/play |
| pause(botId, playbackId?, key?) | POST /zoom-bot/bots/:bot_id/pause | POST /v1/bots/:bot_id/pause |
| resume(botId, playbackId?, key?) | POST /zoom-bot/bots/:bot_id/resume | POST /v1/bots/:bot_id/resume |
| stop(botId, playbackId?, key?) | POST /zoom-bot/bots/:bot_id/stop | POST /v1/bots/:bot_id/stop |

Las dos rutas de salud se añadieron al router/backend para completar los 13 endpoints. También exigen Firebase Auth y UID autorizado al consumirlas por /zoom-bot.

## Entrada y reproducción

Ejemplo dentro de un componente, con sesión iniciada:

```typescript
import { inject } from '@angular/core';
import { firstValueFrom, timer, exhaustMap, filter, take, timeout } from 'rxjs';
import { ZoomBotService } from './shared/services/zoom-bot.service';

// Miembro de tu componente:
private readonly zoomBot = inject(ZoomBotService);

// Miembro de tu componente: solo consulta; nunca vuelve a enviar la orden.
private async waitOperation(operationId: string) {
  const operation = await firstValueFrom(timer(0, 2500).pipe(
    exhaustMap(() => this.zoomBot.getOperation(operationId)),
    filter(op => ['succeeded', 'failed', 'cancelled'].includes(op.status)),
    take(1),
    timeout({ first: 360_000 }),
  ));
  if (operation.status !== 'succeeded') {
    throw new Error(operation.error?.code ?? operation.status);
  }
  return operation;
}

async presentVideo() {
  const capacity = await firstValueFrom(this.zoomBot.getCapacity());
  if (!capacity.accepting_new_sessions || capacity.available_slots < 1) return;

  const joinKey = this.zoomBot.newIdempotencyKey();
  const join = await firstValueFrom(this.zoomBot.joinBot({
    meeting: {
      number: '12345678901', // Sustituir por tu reunión, sin espacios.
      password: 'CONTRASENA_DE_EJEMPLO',
      participant_name: 'Mi VideoBot',
    },
    options: { waiting_room_timeout_seconds: 180, max_session_seconds: 5400 },
  }, joinKey));
  await this.waitOperation(join.operation_id);

  // Guarda bot_id: el bot ya está conectado, pero todavía no emite medios.
  const botId = join.bot_id;
  const playback = await firstValueFrom(this.zoomBot.play(botId, {
    type: 'video',
    url: 'https://storage.googleapis.com/zoom-app-dev.firebasestorage.app/videos/benchmark-1080p30-600s.mp4',
    audio_enabled: true,
  }));
  await this.waitOperation(playback.operation_id);
  // Succeeded significa primeros envíos aceptados, no fin del video.
  const state = await firstValueFrom(this.zoomBot.getBot(botId));
  // Guardar botId y state.playback.playback_id para los botones de control.
}
```

Para consultas simultáneas de estado/operación/eventos, repartir el sondeo: 60 solicitudes/minuto en total por propietario, mutaciones 10/minuto y ráfaga 5. No crear un timer independiente por cada dato con frecuencia de un segundo. Al abandonar el componente, cancelar sus suscripciones.

Un timeout del navegador/espera deja resultado incierto: consulta la operación antes de decidir repetir. Conserva clave y cuerpo del mismo intento; no generes otra clave para intentar recuperar una orden que podría haber sido aplicada. Los links devueltos usan rutas de la API bot; en el frontend consulta mediante getOperation/getBot y sus IDs.

## Audio, imagen y controles

Después de stop o EOF, el mismo bot permite otro medio. Para cambiar uno activo, primero detenerlo y esperar su operación:

```typescript
const state = await firstValueFrom(this.zoomBot.getBot(botId));
const playbackId = state.playback.playback_id ?? undefined;
const pause = await firstValueFrom(this.zoomBot.pause(botId, playbackId));
await this.waitOperation(pause.operation_id);
const resume = await firstValueFrom(this.zoomBot.resume(botId, playbackId));
await this.waitOperation(resume.operation_id);
const stop = await firstValueFrom(this.zoomBot.stop(botId, playbackId));
await this.waitOperation(stop.operation_id);

const audio = await firstValueFrom(this.zoomBot.play(botId, {
  type: 'audio',
  url: 'https://storage.googleapis.com/zoom-app-dev.firebasestorage.app/audios/Vientos%20susurrantes(6).mp3',
}));
await this.waitOperation(audio.operation_id);
await this.waitOperation((await firstValueFrom(this.zoomBot.stop(botId, audio.playback_id ?? undefined))).operation_id);

const image = await firstValueFrom(this.zoomBot.play(botId, {
  type: 'image',
  url: 'https://storage.googleapis.com/zoom-app-dev.firebasestorage.app/images/IMG-20220410-WA0123.jpg',
  duration_seconds: 30, // null/ausente: hasta stop o fin de sesión.
}));
await this.waitOperation(image.operation_id);

const bots = await firstValueFrom(this.zoomBot.listBots({ limit: 20 }));
// Continuar con {cursor: bots.next_cursor} si existe.
const events = await firstValueFrom(this.zoomBot.getEvents(botId, { after_sequence: 0, limit: 50 }));
// Continuar con events.next_after_sequence; deduplicar por sequence.

const leave = await firstValueFrom(this.zoomBot.leaveBot(botId));
await this.waitOperation(leave.operation_id);
const ended = await firstValueFrom(this.zoomBot.getBot(botId));
const capacity = await firstValueFrom(this.zoomBot.getCapacity());
// Confirmar ended.resource_released y capacity.available_slots antes de crear otro bot.
```

Stop tras EOF puede responder 202 y completar no_op=true. EOF y stop conservan al bot en la reunión. Los IDs deben ser UUID. Las órdenes usan Idempotency-Key por defecto, generada una vez por llamada al método; resuscribirse al mismo Observable conserva esa clave. Para repetir desde otra llamada, pásala explícitamente. El servicio no reintenta HTTP automáticamente.

Errores HTTP se entregan como HttpErrorResponse; el código del backend está en error.error.error.code. Sin sesión local, se produce Error('ZOOM_BOT_LOGIN_REQUIRED'). No imprimir objetos completos de peticiones o tokens en consola.

## Verificación realizada

- TypeScript de aplicación y specs sin errores.
- Seis pruebas ChromeHeadless: token Firebase por petición, usuario ausente, clave estable en resuscripción, clave nueva por nueva orden, playback_id protegido, cursores codificados, error HTTP sin reintento e ID inválido.
- Build Angular de desarrollo y producción aprobados. Producción: bundle inicial 779,48 kB; aviso por umbral de 500 kB, sin superar el límite de error de 1 MB. No se modificaron presupuestos.
- Backend: build y lint aprobados; prueba de rutas de salud permitidas, rutas alternativas y mutaciones de salud rechazadas.
- Verificación local con mocks; no hubo login de un usuario real ni llamadas mutables a la API desplegada. El UID dummy debe reemplazarse antes de probar el flujo autenticado real.
