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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BackendService,
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

  it('should make POST request for createBot', () => {
    service.createBot('http://test.com', 'Test Bot').subscribe();
    const req = httpTestingController.expectOne('/recall/create-bot');
    expect(req.request.method).toEqual('POST');
    expect(req.request.body).toEqual({ meeting_url: 'http://test.com', bot_name: 'Test Bot' });
    req.flush({ id: 'bot123' });
  });

  it('should make POST request for removeBot', () => {
    service.removeBot('bot123').subscribe();
    const req = httpTestingController.expectOne('/recall/remove-bot');
    expect(req.request.method).toEqual('POST');
    expect(req.request.body).toEqual({ bot_id: 'bot123' });
    req.flush({ id: 'bot123' });
  });

  it('should make POST request for outputMedia', () => {
    service.outputMedia('bot123', 'http://video.url').subscribe();
    const req = httpTestingController.expectOne('/recall/output-media');
    expect(req.request.method).toEqual('POST');
    expect(req.request.body).toEqual({ bot_id: 'bot123', url: 'http://video.url' });
    req.flush({});
  });

  it('should make DELETE request for stopMedia', () => {
    service.stopMedia('bot123').subscribe();
    const req = httpTestingController.expectOne('/recall/output-media?bot_id=bot123');
    expect(req.request.method).toEqual('DELETE');
    req.flush({});
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
