import { computed, DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  browserLocalPersistence, GoogleAuthProvider, onAuthStateChanged,
  setPersistence, signInWithPopup, signOut, User, UserCredential,
} from 'firebase/auth';

/** Small Firebase boundary so session behavior can be tested without real sign-in. */
export interface FirebaseAuthAdapter {
  currentUser(): User | null;
  ready(): Promise<void>;
  observe(listener: (user: User | null) => void): () => void;
  persistLocally(): Promise<void>;
  signInGoogle(): Promise<UserCredential>;
  signOut(): Promise<void>;
}

export const FIREBASE_AUTH_ADAPTER = new InjectionToken<FirebaseAuthAdapter>('FirebaseAuthAdapter', {
  providedIn: 'root',
  factory: () => {
    const auth = inject(Auth);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return {
      currentUser: () => auth.currentUser,
      ready: () => auth.authStateReady(),
      observe: listener => onAuthStateChanged(auth, listener),
      persistLocally: () => setPersistence(auth, browserLocalPersistence),
      signInGoogle: () => signInWithPopup(auth, provider),
      signOut: () => signOut(auth),
    };
  },
});

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FIREBASE_AUTH_ADAPTER);
  private readonly currentUser = signal<User | null>(this.firebase.currentUser());
  readonly user = this.currentUser.asReadonly();
  readonly username = computed(() => this.user()?.email?.split('@')[0] ||
    this.user()?.displayName || 'Usuario');

  constructor() {
    const unsubscribe = this.firebase.observe(user => this.currentUser.set(user));
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  async waitForSession(): Promise<User | null> {
    await this.firebase.ready();
    this.currentUser.set(this.firebase.currentUser());
    return this.user();
  }

  async signInWithGoogle(): Promise<User> {
    await this.firebase.persistLocally();
    const credential = await this.firebase.signInGoogle();
    this.currentUser.set(credential.user);
    return credential.user;
  }

  async logout(): Promise<void> {
    await this.firebase.signOut();
    this.currentUser.set(null);
  }
}
