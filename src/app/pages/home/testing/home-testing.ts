import { computed, Provider, signal } from '@angular/core';
import { User } from 'firebase/auth';
import { AuthService } from '../../../shared/services/auth.service';
import { Firestore } from '@angular/fire/firestore';
import { of } from 'rxjs';
import { BackendService } from '../../../shared/services/backend.service';
import { MeetingsService } from '../../../shared/services/meetings.service';
import { ZoomBotService } from '../../../shared/services/zoom-bot.service';
import { VideoListsService } from '../../../shared/services/video-lists.service';
import { ModalService } from '../../../shared/services/modal.service';
import { LoadingService } from '../../../shared/services/loading.service';
import { VideoItem } from '../../../shared/interfaces';

/**
 * Test-only helpers shared by the HomeStateService / HomePage / layout specs.
 * Excluded from the app build via tsconfig.app.json ("src/**\/testing/**").
 */
export interface HomeServiceMocks {
  auth: any;
  backend: any;
  meetings: any;
  videoLists: any;
  zoom: any;
  modal: any;
  loading: any;
}

export function createHomeServiceMocks(): HomeServiceMocks {
  const signedInUser = { uid: 'test-user', email: 'allan@example.com', displayName: 'Allan' } as User;
  const user = signal<User | null>(signedInUser);
  return {
    auth: {
      user,
      username: computed(() => user()?.email?.split('@')[0] || 'Usuario'),
      waitForSession: jasmine.createSpy('waitForSession').and.callFake(async () => user()),
      signInWithGoogle: jasmine.createSpy('signInWithGoogle').and.callFake(async () => {
        user.set(signedInUser);
        return signedInUser;
      }),
      logout: jasmine.createSpy('logout').and.callFake(async () => user.set(null)),
    },
    backend: {
      videos$: of([]),
      configData$: of({ botId: '', busyRow: '', playing: false, globalVideoOrder: [] }),
      setConfig: jasmine.createSpy('setConfig').and.returnValue(Promise.resolve()),
      createBot: jasmine.createSpy('createBot').and.returnValue(of({ bot_id: 'bot123', operation_id: 'operation123', status: 'queued' })),
      removeBot: jasmine.createSpy('removeBot').and.returnValue(of({ bot_id: 'bot123', operation_id: 'operation123', status: 'queued' })),
      outputMedia: jasmine.createSpy('outputMedia').and.returnValue(of({})),
      stopMedia: jasmine.createSpy('stopMedia').and.returnValue(of({})),
      uploadVideo: jasmine.createSpy('uploadVideo').and.returnValue(Promise.resolve()),
      deleteVideo: jasmine.createSpy('deleteVideo').and.returnValue(Promise.resolve()),
      listDriveFiles: jasmine.createSpy('listDriveFiles').and.returnValue(of({ files: [] })),
      importDriveFile: jasmine.createSpy('importDriveFile').and.returnValue(of({ gcsPath: '' })),
    },
    meetings: {
      meetings$: of([]),
      convertUrl: jasmine.createSpy('convertUrl').and.callFake((url: string) => url),
      addMeeting: jasmine.createSpy('addMeeting').and.returnValue(Promise.resolve()),
      deleteMeeting: jasmine.createSpy('deleteMeeting').and.returnValue(Promise.resolve()),
    },
    videoLists: {
      lists$: of([]),
      addList: jasmine.createSpy('addList').and.returnValue(Promise.resolve()),
      updateList: jasmine.createSpy('updateList').and.returnValue(Promise.resolve()),
      deleteList: jasmine.createSpy('deleteList').and.returnValue(Promise.resolve()),
    },
    zoom: {
      getVm: jasmine.createSpy('getVm').and.returnValue(of({ name: 'zoom-bot-vm', status: 'RUNNING' })),
      startVm: jasmine.createSpy('startVm').and.returnValue(of({ name: 'zoom-bot-vm', status: 'PROVISIONING', operation: { name: 'vm-start-op', status: 'PENDING', error: null } })),
      stopVm: jasmine.createSpy('stopVm').and.returnValue(of({ name: 'zoom-bot-vm', status: 'STOPPING', operation: { name: 'vm-stop-op', status: 'PENDING', error: null } })),
      getReadiness: jasmine.createSpy('getReadiness').and.returnValue(of({ status: 'ready' })),
      getOperation: jasmine.createSpy('getOperation').and.returnValue(of({ status: 'succeeded', error: null })),
      getBot: jasmine.createSpy('getBot').and.returnValue(of({ status: 'active', resource_released: false })),
      shareApp: jasmine.createSpy('shareApp').and.returnValue(Promise.resolve()),
    },
    modal: {
      confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve(true)),
    },
    loading: {
      show: jasmine.createSpy('show'),
      hide: jasmine.createSpy('hide'),
    },
  };
}

export function provideHomeServiceMocks(mocks: HomeServiceMocks): Provider[] {
  return [
    { provide: AuthService, useValue: mocks.auth },
    { provide: Firestore, useValue: {} },
    { provide: BackendService, useValue: mocks.backend },
    { provide: MeetingsService, useValue: mocks.meetings },
    { provide: VideoListsService, useValue: mocks.videoLists },
    { provide: ZoomBotService, useValue: mocks.zoom },
    { provide: ModalService, useValue: mocks.modal },
    { provide: LoadingService, useValue: mocks.loading },
  ];
}

export function makeVideo(videoPath: string, overrides: Partial<VideoItem> = {}): VideoItem {
  return {
    videoPath,
    videoUrl: `https://storage/${videoPath}`,
    duration: 10,
    thumbnailPath: '',
    thumbnailUrl: '',
    ...overrides,
  };
}
