import { TestBed } from '@angular/core/testing';
import { TabsComponent } from './tabs.component';
describe('TabsComponent', () => {
 it('selects tabs by click and keyboard with accessible state', () => {
  const fixture=TestBed.createComponent(TabsComponent);
  fixture.componentRef.setInput('tabs',[{id:'videos',label:'Videos'},{id:'audios',label:'Audios'}]); fixture.componentRef.setInput('active','videos'); fixture.detectChanges();
  const selected=spyOn(fixture.componentInstance.selected,'emit');
  const buttons=fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
  expect(buttons[0].getAttribute('aria-selected')).toBe('true'); expect(buttons[1].tabIndex).toBe(-1);
  buttons[1].click(); expect(selected).toHaveBeenCalledWith('audios');
  buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft'})); expect(selected).toHaveBeenCalledWith('audios');
 });
});
