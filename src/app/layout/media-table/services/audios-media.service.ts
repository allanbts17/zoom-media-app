import { Injectable, inject } from '@angular/core';
import { MediaPlaybackService } from './media-playback.service';
import { BackendService } from '../../../shared/services/backend.service';
@Injectable()
export class AudiosMediaService extends MediaPlaybackService {
  override readonly kind = 'audio' as const;
  private readonly audioBackend = inject(BackendService);
  uploading = false;
  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || this.uploading) return;
    this.uploading = true;
    try { for (const file of Array.from(input.files)) await this.audioBackend.uploadAudio(file); }
    catch(error: any) { this.state.err = error?.message ?? 'Error subiendo audio'; }
    finally { this.uploading = false; input.value = ''; }
  }
}
