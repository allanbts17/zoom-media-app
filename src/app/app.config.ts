import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from './environments/environment';
import { initializeFirestore } from 'firebase/firestore';

let firebaseApp: any;
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideFirebaseApp(() => {
      firebaseApp = initializeApp(environment.firebase)
      return firebaseApp;
    }),
    provideFirestore(() => {
      return initializeFirestore(firebaseApp, {
        ignoreUndefinedProperties: true,
      }, 'default'); // ← Especifica el ID de tu base de datos
    })
  ]
};
