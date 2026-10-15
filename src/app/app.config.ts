import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from './environments/environment';
import { initializeFirestore } from 'firebase/firestore';

let firebaseApp: any;
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideFirebaseApp(() => {
      firebaseApp = initializeApp(environment.firebase)
      return firebaseApp;
    }),
    provideAuth(() => getAuth()),
    provideFirestore(() => {
      return initializeFirestore(firebaseApp, {
        ignoreUndefinedProperties: true,
      }, 'default'); // ← Especifica el ID de tu base de datos
    })
  ]
};
