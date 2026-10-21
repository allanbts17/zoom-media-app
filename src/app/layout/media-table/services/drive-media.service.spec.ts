import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DriveMediaService } from './drive-media.service';
import { HomeStateService } from '../../../pages/home/home-state.service';
import { createHomeServiceMocks, provideHomeServiceMocks } from '../../../pages/home/testing/home-testing';
describe('DriveMediaService', () => {
 let service: DriveMediaService; let mocks: ReturnType<typeof createHomeServiceMocks>;
 beforeEach(() => { mocks = createHomeServiceMocks(); TestBed.configureTestingModule({providers:[HomeStateService,DriveMediaService,...provideHomeServiceMocks(mocks)]}); service=TestBed.inject(DriveMediaService); });
 it('filters and imports Drive files', async () => {
  const file={id:'a',name:'504 Himno',mimeType:'video/mp4'};
  mocks.backend.listDriveFiles.and.returnValue(of({files:[file]})); await service.loadDriveFiles(false);
  TestBed.inject(HomeStateService).driveSearchQuery.set('504'); expect(service.filteredDriveFiles).toEqual([file]);
  await service.importDriveFile(file); expect(mocks.backend.importDriveFile).toHaveBeenCalledWith('a','504 Himno'); expect(mocks.loading.hide).toHaveBeenCalled();
 });
 it('cleans up an unsuccessful import', async () => {
  mocks.backend.importDriveFile.and.returnValue(throwError(()=>new Error('Falló')));
  await service.importDriveFile({id:'a',name:'a',mimeType:'video/mp4'});
  expect(service.driveError).toBe('Falló'); expect(service.driveImportingId).toBe(''); expect(mocks.loading.hide).toHaveBeenCalled();
 });
});
