import { Component, input, output } from '@angular/core';
export interface TabItem { id: string; label: string; }
@Component({
 selector: 'app-tabs',
 template: `<div role="tablist" aria-label="Tipos de medios" class="flex border-b border-gray-300 dark:border-white/20 mb-3 overflow-x-auto">
 @for(tab of tabs(); track tab.id; let index = $index) {
 <button type="button" role="tab" [id]="idPrefix() + '-tab-' + tab.id" [attr.aria-controls]="idPrefix() + '-panel-' + tab.id" [attr.aria-selected]="active() === tab.id" [disabled]="disabled()" [tabIndex]="active() === tab.id ? 0 : -1" (click)="selected.emit(tab.id)" (keydown)="navigate($event,index)" class="px-4 py-3 border-b-2 font-medium whitespace-nowrap" [class.border-blue-500]="active() === tab.id" [class.text-blue-600]="active() === tab.id" [class.border-transparent]="active() !== tab.id">{{tab.label}}</button>
 }</div>`
})
export class TabsComponent {
 readonly idPrefix = input('media');
 readonly disabled = input(false);
 readonly tabs = input.required<readonly TabItem[]>();
 readonly active = input.required<string>();
 readonly selected = output<string>();
 navigate(event: KeyboardEvent, index: number) {
  if(this.disabled()) return;
  const length = this.tabs().length;
  const next = event.key === 'ArrowRight' ? (index + 1) % length : event.key === 'ArrowLeft' ? (index + length - 1) % length : event.key === 'Home' ? 0 : event.key === 'End' ? length - 1 : -1;
  if(next < 0) return;
  event.preventDefault(); this.selected.emit(this.tabs()[next].id);
  const parent = (event.currentTarget as HTMLElement).parentElement;
  (parent?.querySelectorAll('button')[next] as HTMLElement)?.focus();
 }
}
