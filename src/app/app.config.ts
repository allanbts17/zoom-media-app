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
    // provideFirestore(() => getFirestore()),
    //provideFirebaseApp(() => initializeApp({ projectId: "zoom-app-dev", appId: "1:722146628233:web:64f174cbaa2b35cce1ac58", storageBucket: "zoom-app-dev.firebasestorage.app", apiKey: "AIzaSyAEFHRYjXknKP_qy6TXuYt1Z36YhR93yag", authDomain: "zoom-app-dev.firebaseapp.com", messagingSenderId: "722146628233", measurementId: "G-4J04DB3D7R"})),
    provideFirestore(() => {
      //       const firestore = getFirestore();
      // return firestore;
      return initializeFirestore(firebaseApp, {
        ignoreUndefinedProperties: true,
      }, 'default'); // ← Especifica el ID de tu base de datos
    })
  ]
};
