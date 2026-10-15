import { TestBed } from '@angular/core/testing';
import { User, UserCredential } from 'firebase/auth';
import { AuthService, FirebaseAuthAdapter, FIREBASE_AUTH_ADAPTER } from './auth.service';

describe('AuthService', () => {
  let adapter: jasmine.SpyObj<FirebaseAuthAdapter>;
  let current: User | null;
  let notify: (user: User | null) => void;
  let unsubscribe: jasmine.Spy;
  const user = { uid: 'u1', email: 'allan.music@example.com', displayName: 'Allan' } as User;

  beforeEach(() => {
    current = null;
    unsubscribe = jasmine.createSpy('unsubscribe');
    adapter = jasmine.createSpyObj<FirebaseAuthAdapter>('FirebaseAuthAdapter',
      ['currentUser', 'ready', 'observe', 'persistLocally', 'signInGoogle', 'signOut']);
    adapter.currentUser.and.callFake(() => current);
    adapter.ready.and.resolveTo();
    adapter.observe.and.callFake(listener => { notify = listener; listener(current); return unsubscribe; });
    adapter.persistLocally.and.resolveTo();
    adapter.signInGoogle.and.callFake(async () => {
      current = user;
      return { user } as UserCredential;
    });
    adapter.signOut.and.callFake(async () => { current = null; });
    TestBed.configureTestingModule({ providers: [{ provide: FIREBASE_AUTH_ADAPTER, useValue: adapter }] });
  });

  it('waits for Firebase restoration before reporting the session', async () => {
    let resolve!: () => void;
    adapter.ready.and.returnValue(new Promise<void>(done => resolve = done));
    const service = TestBed.inject(AuthService);
    let completed = false;
    const ready = service.waitForSession().then(value => { completed = true; return value; });
    await Promise.resolve();
    expect(completed).toBeFalse();
    current = user;
    resolve();
    expect(await ready).toBe(user);
    expect(service.user()).toBe(user);
  });

  it('configures local persistence before starting Google and exposes the email prefix', async () => {
    const service = TestBed.inject(AuthService);
    const order: string[] = [];
    adapter.persistLocally.and.callFake(async () => { order.push('persistence'); });
    adapter.signInGoogle.and.callFake(async () => { order.push('popup'); return { user } as UserCredential; });
    await service.signInWithGoogle();
    expect(order).toEqual(['persistence', 'popup']);
    expect(service.username()).toBe('allan.music');
  });

  it('clears the session after logout and follows external session changes', async () => {
    const service = TestBed.inject(AuthService);
    notify(user);
    expect(service.user()).toBe(user);
    await service.logout();
    expect(adapter.signOut).toHaveBeenCalledTimes(1);
    expect(service.user()).toBeNull();
    notify(user);
    notify(null);
    expect(service.user()).toBeNull();
  });

  it('keeps the user signed in if logout fails', async () => {
    const service = TestBed.inject(AuthService);
    notify(user);
    adapter.signOut.and.rejectWith(new Error('network'));
    await expectAsync(service.logout()).toBeRejected();
    expect(service.user()).toBe(user);
  });

  it('releases the Firebase observer when its injector is destroyed', () => {
    TestBed.inject(AuthService);
    TestBed.resetTestingModule();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
