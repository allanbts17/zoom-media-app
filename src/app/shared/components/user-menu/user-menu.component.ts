import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.css',
})
export class UserMenuComponent {
  readonly auth = inject(AuthService);
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  toggle(): void {
    this.error.set('');
    this.open.update(value => !value);
  }

  @HostListener('document:click', ['$event'])
  @HostListener('document:focusin', ['$event'])
  closeOutside(event: Event): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  async logout(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.logout();
      this.open.set(false);
      // Home observes session changes and returns to the login page.
    } catch {
      this.error.set('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }
}
