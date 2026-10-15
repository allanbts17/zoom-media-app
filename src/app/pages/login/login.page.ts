import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly registration = inject(ActivatedRoute).snapshot.data['registration'] === true;
  readonly busy = signal(false);
  readonly error = signal('');

  async continueWithGoogle(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.signInWithGoogle();
      await this.router.navigateByUrl('/home', { replaceUrl: true });
    } catch (error: unknown) {
      const code = (error as { code?: string } | null)?.code;
      const messages: Record<string, string> = {
        'auth/popup-closed-by-user': 'La ventana se cerró antes de completar el acceso. Puedes intentarlo de nuevo.',
        'auth/cancelled-popup-request': 'Se canceló el acceso. Puedes intentarlo de nuevo.',
        'auth/popup-blocked': 'Permite las ventanas emergentes para continuar con Google.',
        'auth/unauthorized-domain': 'Este dominio todavía no está habilitado para iniciar sesión.',
        'auth/operation-not-allowed': 'El acceso con Google todavía no está habilitado.',
        'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.',
        'auth/web-storage-unsupported': 'El navegador no permite guardar la sesión. Revisa sus ajustes de almacenamiento.',
      };
      this.error.set(messages[code ?? ''] ?? 'No se pudo completar el acceso con Google. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }
}
