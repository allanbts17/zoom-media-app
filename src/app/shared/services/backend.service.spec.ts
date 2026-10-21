import { of } from 'rxjs';
import { ZoomBotService } from './zoom-bot.service';
import { TestBed } from '@angular/core/testing';
import { BackendService } from './backend.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { VideoItem } from '../interfaces';

describe('BackendService', () => {
  let service: BackendService;
  let httpTestingController: HttpTestingController;

  const zoom = {play:jasmine.createSpy('play').and.returnValue(of({}))};
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BackendService,
        {provide:ZoomBotService,useValue:zoom},
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFirebaseApp(() => initializeApp({ projectId: 'test', appId: '1:123:web:123', apiKey: 'test' })),
        provideFirestore(() => getFirestore()),
      ],
    });

    service = TestBed.inject(BackendService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should make GET request for listVideos', () => {
    service.listVideos().subscribe();
    const req = httpTestingController.expectOne('/videos');
    expect(req.request.method).toEqual('GET');
    req.flush([]);
  });

  it('should make POST request for deleteVideo', () => {
    const mockItem: VideoItem = { videoPath: 'path', videoUrl: 'url', duration: 0, thumbnailPath: '', thumbnailUrl: '' };
    service.deleteVideo(mockItem);
    const req = httpTestingController.expectOne('/videos/delete');
    expect(req.request.method).toEqual('POST');
    expect(req.request.body).toEqual({ videoData: mockItem });
    req.flush({});
  });

  it('sends audio media to the bot', () => {
    service.play('bot123','audio','https://audio/a.mp3').subscribe();
    expect(zoom.play).toHaveBeenCalledWith('bot123',{type:'audio',url:'https://audio/a.mp3'});
  });
  it('uploads WAV with the same content type as the signed URL', async () => {
    spyOn(window,'fetch').and.returnValue(Promise.resolve({ok:true} as Response));
    const pending=service.uploadAudio(new File(['audio'],'a.wav',{type:'audio/x-wav'}));
    await Promise.resolve();
    const req=httpTestingController.expectOne('/audios/upload-url'); expect(req.request.body).toEqual({filename:'a.wav'}); req.flush({uploadUrl:'https://upload'});
    await pending; expect(window.fetch).toHaveBeenCalledWith('https://upload',jasmine.objectContaining({headers:{'Content-Type':'audio/wav'}}));
  });
  it('rejects unsupported audio extensions before requesting upload', async () => {
    await expectAsync(service.uploadAudio(new File(['audio'],'a.ogg'))).toBeRejectedWithError('Solo se permiten MP3 y WAV');
  });
  it('deletes an audio by its storage path', async () => {
    const pending=service.deleteAudio('audios/a.mp3'); const req=httpTestingController.expectOne('/audios/delete'); expect(req.request.body).toEqual({audioPath:'audios/a.mp3'}); req.flush({ok:true}); await pending;
  });

  // ── Google Drive tests ────────────────────────────────────────────────────

  it('should make GET request for listDriveFiles', () => {
    const mockFiles = [
      { id: 'file1', name: 'video.mp4', mimeType: 'video/mp4', size: 1024 },
    ];
    service.listDriveFiles().subscribe((result) => {
      expect(result.files.length).toBe(1);
      expect(result.files[0].id).toBe('file1');
    });
    const req = httpTestingController.expectOne('/drive/files');
    expect(req.request.method).toEqual('GET');
    req.flush({ files: mockFiles });
  });

  it('should make POST request for importDriveFile', () => {
    service.importDriveFile('file1', 'video.mp4').subscribe((result) => {
      expect(result.gcsPath).toBe('videos/video.mp4');
    });
    const req = httpTestingController.expectOne('/drive/import');
    expect(req.request.method).toEqual('POST');
    expect(req.request.body).toEqual({ fileId: 'file1', fileName: 'video.mp4' });
    req.flush({ gcsPath: 'videos/video.mp4' });
  });
});
