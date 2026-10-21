import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectionBarLayout } from './selection-bar.layout';
import { HomeStateService } from '../../pages/home/home-state.service';
import { createHomeServiceMocks, makeVideo, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('SelectionBarLayout', () => {
  let fixture: ComponentFixture<SelectionBarLayout>;
  let state: HomeStateService;
  let component: SelectionBarLayout;
  let mocks: ReturnType<typeof createHomeServiceMocks>;
  let el: HTMLElement;

  beforeEach(async () => {
    mocks = createHomeServiceMocks();
    await TestBed.configureTestingModule({
      imports: [SelectionBarLayout],
      providers: [HomeStateService, ...provideHomeServiceMocks(mocks)]
    }).compileComponents();

    state = TestBed.inject(HomeStateService);
    state.videos = [makeVideo('v1'), makeVideo('v2')];
    fixture = TestBed.createComponent(SelectionBarLayout);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const buttonByText = (text: string) =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

  const selectVideos = (...paths: string[]) => {
    paths.forEach(p => state.selectedMap[p] = true);
    fixture.detectChanges();
  };

  it('should be hidden when nothing is selected', () => {
    expect(el.textContent?.trim()).toBe('');
  });

  it('should show the selected count', () => {
    selectVideos('v1', 'v2');
    expect(el.textContent).toContain('2 seleccionados');
  });

  it('should be hidden in reorder mode', () => {
    selectVideos('v1');
    state.reorderMode = true;
    fixture.detectChanges();
    expect(el.textContent).not.toContain('seleccionados');
  });

  it('should create a new list with the typed name', async () => {
    selectVideos('v1');
    const createSpy = spyOn(component, 'createNewList').and.returnValue(Promise.resolve());
    const input = el.querySelector('input[placeholder="Nueva lista..."]') as HTMLInputElement;

    input.value = 'Mi lista';
    input.dispatchEvent(new Event('input'));
    buttonByText('Crear lista')!.click();

    expect(component.newListTitle).toBe('Mi lista');
    expect(createSpy).toHaveBeenCalled();
  });

  it('should add the selection to the chosen list', () => {
    state.videoLists = [{ id: 'l1', name: 'Domingo', videoPaths: [] }];
    selectVideos('v1');
    const addSpy = spyOn(component, 'addSelectedToList').and.returnValue(Promise.resolve());

    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = 'l1';
    buttonByText('Añadir')!.click();

    expect(addSpy).toHaveBeenCalledWith('l1');
  });

  it('should only offer "Quitar de lista" when a list is active', () => {
    selectVideos('v1');
    expect(buttonByText('Quitar de lista')).toBeUndefined();

    state.activeListId.set('l1');
    fixture.detectChanges();
    const removeSpy = spyOn(component, 'removeSelectedFromCurrentList').and.returnValue(Promise.resolve());
    buttonByText('Quitar de lista')!.click();

    expect(removeSpy).toHaveBeenCalled();
  });

  it('should delete the selected videos', () => {
    selectVideos('v1');
    const deleteSpy = spyOn(component, 'deletedSelectedVideos').and.returnValue(Promise.resolve());
    buttonByText('Eliminar')!.click();
    expect(deleteSpy).toHaveBeenCalled();
  });

  it('creates an audio-only list', async () => {
    state.activeTab.set('audios'); state.audios=[{audioPath:'audios/a.mp3',audioUrl:'a',duration:1}]; state.selectedMap={'audios/a.mp3':true}; component.newListTitle='Audio';
    await component.createNewList(); expect(mocks.videoLists.addList).toHaveBeenCalledWith('Audio',[],['audios/a.mp3']);
  });
  it('adds audio without overwriting other list segments', async () => {
    state.activeTab.set('audios'); state.audios=[{audioPath:'audios/a.mp3',audioUrl:'a',duration:1}]; state.selectedMap={'audios/a.mp3':true};
    state.videoLists=[{id:'mixed',name:'Mixed',videoPaths:['videos/a.mp4'],docPaths:['docs/a.pptx']}];
    await component.addSelectedToList('mixed'); expect(mocks.videoLists.updateList).toHaveBeenCalledWith('mixed',{audioPaths:['audios/a.mp3']});
  });
  it('removes audio without removing the list or its documents', async () => {
    state.activeTab.set('audios'); state.activeListId.set('mixed'); state.audios=[{audioPath:'audios/a.mp3',audioUrl:'a',duration:1}]; state.selectedMap={'audios/a.mp3':true};
    state.videoLists=[{id:'mixed',name:'Mixed',videoPaths:[],audioPaths:['audios/a.mp3'],docPaths:['docs/a.pptx']}];
    await component.removeSelectedFromCurrentList(); expect(mocks.videoLists.updateList).toHaveBeenCalledWith('mixed',{audioPaths:[]}); expect(state.videoLists.length).toBe(1);
  });
  it('deletes the original video document with its thumbnail metadata', async () => {
    const video = makeVideo('videos/a.mp4', {thumbnailPath:'thumbnails/a.jpg'});
    state.videos=[video]; state.selectedMap={'videos/a.mp4':true};
    await component.deletedSelectedVideos();
    expect(mocks.backend.deleteVideo).toHaveBeenCalledWith(video);
    expect(mocks.backend.deleteAudio).not.toHaveBeenCalled();
  });

  it('deletes audio by its audioPath without using the video endpoint', async () => {
    state.activeTab.set('audios'); state.audios=[{audioPath:'audios/a.mp3',audioUrl:'a',duration:1}]; state.selectedMap={'audios/a.mp3':true};
    await component.deletedSelectedVideos();
    expect(mocks.backend.deleteAudio).toHaveBeenCalledWith('audios/a.mp3');
    expect(mocks.backend.deleteVideo).not.toHaveBeenCalled();
  });
});
