# Swagger público

URL: https://zoom-app-dev.web.app/api-docs/
Contrato: https://zoom-app-dev.web.app/api-docs/openapi.json

Documenta los 13 endpoints de la API del bot en Cloud Run, con parámetros, ejemplos y respuestas. Es una copia estática, accesible sin sesión y sin depender de la VM. No contiene credenciales. Los archivos Swagger UI 5.30.2 se alojan junto al contrato; no se cargan desde un CDN en cada visita.

La página es de consulta: `supportedSubmitMethods: []` deshabilita Try it out, y `validatorUrl: null` evita enviar el contrato al validador externo. Para ejecutar solicitudes autenticadas, corre `./scripts/open-swagger.ps1` desde el repositorio meetingsdk-linux-raw-recording-sample y abre http://localhost:8085/docs. La API conserva IAM; Firebase Auth no sustituye su ID token.

## Actualizar el contrato

Desde el repositorio del bot, en un entorno Python con las dependencias de `api/requirements-http.txt` instaladas:

```powershell
python api/tools/export_openapi.py D:/Proyects/zoom-media-app/frontend/public/api-docs/openapi.json
```

Después, desde frontend:

```powershell
npm run build
firebase deploy --only hosting --project zoom-app-dev
```

Ese despliegue publica todo el frontend compilado junto con Swagger. Revisar los cambios del frontend antes de publicarlo. Angular copia public/api-docs automáticamente al build. Cuando cambien endpoints, regenerar el JSON; la copia pública no se actualiza sola.

La publicación inicial añadió únicamente api-docs y conservó los archivos/configuración de la versión existente de Hosting.

Referencias: [Swagger UI](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/) y [Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart).
