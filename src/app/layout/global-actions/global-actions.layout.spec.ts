import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GlobalActionsLayout } from './global-actions.layout';
import { HomeStore } from '../../pages/home/home.store';
import { createHomeServiceMocks, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('GlobalActionsLayout', () => {
  let fixture: ComponentFixture<GlobalActionsLayout>;
  let store: HomeStore;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalActionsLayout],
      providers: [HomeStore, ...provideHomeServiceMocks(createHomeServiceMocks())]
    }).compileComponents();

    store = TestBed.inject(HomeStore);
    fixture = TestBed.createComponent(GlobalActionsLayout);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const buttonByText = (text: string) =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should only enable "Detener" when there is a bot', () => {
    expect(buttonByText('Detener')!.disabled).toBeTrue();

    store.botId = 'bot-1';
    fixture.detectChanges();
    const stopSpy = spyOn(store, 'stopNow').and.returnValue(Promise.resolve());
    buttonByText('Detener')!.click();

    expect(stopSpy).toHaveBeenCalled();
  });

  it('should list the video lists and change the active list', async () => {
    store.videoLists = [{ id: 'l1', name: 'Domingo', videoPaths: [] }];
    fixture.detectChanges();

    const select = el.querySelector('select') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.textContent?.trim());
    expect(options).toEqual(['Todos los videos', 'Domingo']);

    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    expect(store.activeListId()).toBe('l1');
  });

  it('should only show the delete list button when a list is active', () => {
    expect(el.querySelector('button[title="Borrar lista actual"]')).toBeNull();

    store.activeListId.set('l1');
    fixture.detectChanges();
    const deleteBtn = el.querySelector('button[title="Borrar lista actual"]') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();

    const deleteSpy = spyOn(store, 'deleteCurrentList').and.returnValue(Promise.resolve());
    deleteBtn.click();
    expect(deleteSpy).toHaveBeenCalled();
  });

  it('should toggle reorder mode and show "Cancelar" while reordering', () => {
    expect(buttonByText('Cancelar')).toBeUndefined();
    const toggleSpy = spyOn(store, 'toggleReorder').and.callThrough();

    buttonByText('Reordenar')!.click();
    fixture.detectChanges();

    expect(toggleSpy).toHaveBeenCalled();
    expect(store.reorderMode).toBeTrue();
    expect(buttonByText('Guardar orden')).toBeTruthy();

    const cancelSpy = spyOn(store, 'cancelReorder').and.callThrough();
    buttonByText('Cancelar')!.click();
    fixture.detectChanges();

    expect(cancelSpy).toHaveBeenCalled();
    expect(buttonByText('Reordenar')).toBeTruthy();
  });
});
