# Laboratorio de endpoints de Zoom

La ruta `/api-docs` ahora es una página Angular autenticada. Sustituye la interfaz estática de Swagger y consume los 16 endpoints `/zoom-bot` del backend Express. Toda la lógica del laboratorio vive en `src/app/pages/api-docs/api-docs.page.ts`, con su HTML y CSS en la misma carpeta. No modifica ZoomBotService ni el backend.

## Probar localmente

Desde frontend:

```powershell
npm start
```

Inicia sesión con Google y abre http://localhost:4200/api-docs (también hay un enlace Laboratorio API en Home). La ruta valida la restauración de Firebase Auth; cada envío obtiene el token actual. El backend sigue verificando el UID permitido en ZOOM_BOT_ALLOWED_UIDS.

El proxy de Angular dirige `/zoom-bot/**` al backend desplegado. No se requiere ejecutar open-swagger.ps1 para este laboratorio. El endpoint real y la sesión son reales: no se usa Cloud Run directamente desde el navegador.

## Usar el laboratorio

1. Selecciona un endpoint. Edita bot_id u operation_id cuando la ruta lo necesite.
2. Edita la query string, JSON y headers adicionales. Authorization lo gestiona Firebase; Idempotency-Key tiene su propio campo.
3. Pulsa Enviar petición. No hay peticiones automáticas al abrir la página, polling ni reintentos automáticos.
4. Revisa código HTTP, tiempo, cuerpo completo y headers. Los errores 400/401/403/422/503 se muestran igual que los resultados exitosos; el texto no JSON también se conserva.
5. Un 202 solo acepta una orden. El laboratorio captura bot_id, operation_id y playback_id de las respuestas exitosas para reutilizarlos. Selecciona Consultar operación para ver el resultado.

El cuerpo se envía como texto sin corregir ni validar su contenido: permite probar incluso JSON inválido. Los identificadores no se validan como UUID en el laboratorio para poder probar la validación del backend. Los headers adicionales deben tener formato de objeto JSON con valores de texto.

Una clave de idempotencia se conserva al reenviar. Conserva clave y cuerpo para reintentar la misma orden; pulsa Nueva clave para una orden distinta. Cambiar de endpoint también genera otra clave. Dejar el campo vacío permite comprobar el error de clave ausente.

Dejar de esperar cancela la escucha del navegador: no garantiza que el backend haya cancelado una orden ya aceptada. Usa Salir de la reunión para retirar un bot cuando corresponda.

## VM apagada

Consultar el estado no enciende la VM. Solo los endpoints explícitos POST /vm/start y POST /vm/stop cambian su estado. Permite probar autenticación y las respuestas de disponibilidad sin agente. Las rutas que necesiten la VM pueden responder 503; no pueden entrar a Zoom ni reproducir medios mientras esté apagada. Proceso HTTP no equivale a agente disponible.

Los datos de petición y respuesta viven en memoria de la página y no se guardan en localStorage. Los headers de respuesta visibles son los que el navegador expone. El contrato OpenAPI anterior se conserva como archivo auxiliar en public/api-docs/openapi.json; la página no lo utiliza.

## Verificación y publicación

`npm run build` incluye el laboratorio como ruta diferida y ya no copia un index.html estático de Swagger que intercepte /api-docs. Para publicarlo, desplegar el frontend compilado con el procedimiento habitual de Hosting. La implementación de este cambio se dejó local, sin desplegar ni encender la VM.

Pruebas del laboratorio y ZoomBotService: 18 aprobadas en ChromeHeadless con HTTP simulado. La suite general actual tiene dos errores de tipos en backend.service.spec.ts, por referencias antiguas a outputMedia/stopMedia; no se modificaron esas pruebas ni el servicio en este cambio.

## VM y mensajes del panel

- GET /zoom-bot/vm: estado real de Compute Engine. Funciona con la VM apagada.
- GET /zoom-bot/vm?operation=nombre: añade el resultado de una operación de GCE de esta misma VM.
- POST /zoom-bot/vm/start: consulta el estado y solicita arranque solo si corresponde.
- POST /zoom-bot/vm/stop: consulta el estado y solicita detención solo si corresponde. Apagar desconecta cualquier bot dentro de Zoom.

Los POST reciben un objeto vacío. Idempotency-Key puede ser un UUID para deduplicar con Compute Engine. Sus respuestas pueden ser 200 si el estado ya es el solicitado o 202 mientras progresa. Las operaciones de GCE (operation.name) son distintas de las operaciones del bot (operation_id).

Home consulta la VM al abrirse. El botón a la derecha de Retirar bot cambia entre encender, detener y actualizar estado, con spinner durante las transiciones. Comprueba también /health/ready antes de habilitar la entrada: VM RUNNING no implica agente listo. El seguimiento de VM consulta cada tres segundos, hasta cinco minutos, y se cancela al abandonar la página.

Crear bot conserva el estado Conectando hasta que su operación termine; consulta cada dos segundos. Un 202 ya no se presenta como bot conectado. Salir también espera el resultado antes de borrar el ID. Los mensajes de progreso permanecen hasta terminar; los mensajes finales se ocultan a los seis segundos y los errores a los doce segundos.

Se redujo a seis segundos el timeout HTTP del backend para /health/live y /health/ready. No se redujo el timeout de órdenes del bot. La consulta de VM usa Compute Engine, sin depender del agente.

## Publicar backend

Desde backend, después de revisar los cambios:

```powershell
npm run deploy:api
```

Hace falta desplegar el backend para que el proxy del frontend encuentre las rutas /vm nuevas. No hay cambios en el contenedor del bot ni en la VM. La cuenta de servicio del backend necesita compute.instances.get, compute.instances.start, compute.instances.stop y compute.zoneOperations.get. Actualmente usa 722146628233-compute@developer.gserviceaccount.com con roles/editor ya existente; no se modificó IAM. Los endpoints conservan Firebase Auth y ZOOM_BOT_ALLOWED_UIDS, y fijan proyecto/VM/zona en el servidor.

Referencia: [Compute Engine start/stop](https://cloud.google.com/compute/docs/instances/stop-start-instance) y [operaciones asíncronas](https://cloud.google.com/compute/docs/api/how-tos/api-requests-responses).
