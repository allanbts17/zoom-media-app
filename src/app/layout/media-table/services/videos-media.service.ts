import { Injectable } from '@angular/core';
import { MediaPlaybackService } from './media-playback.service';
@Injectable()
export class VideosMediaService extends MediaPlaybackService { readonly kind = 'video' as const; }
