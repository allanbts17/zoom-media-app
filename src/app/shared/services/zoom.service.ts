import { Injectable } from '@angular/core';
import zoomSdk from '@zoom/appssdk';

@Injectable({
  providedIn: 'root',
})
export class ZoomService {
  ready = false;

  async init(): Promise<void> {
    try {
      await zoomSdk.config({
        popoutSize: { width: 960, height: 640 },
        capabilities: [
          'getRunningContext',
          'getMeetingContext',
          'getMeetingUUID',
          'shareApp',
          'openUrl',
        ],
      });
      this.ready = true;
    } catch {
      this.ready = false; // fuera de Zoom está bien
    }
  }

  async shareApp(): Promise<void> {
    if (!this.ready) return;
    try {
      await zoomSdk.shareApp({ action: 'start', withSound: true });
    } catch {
      // ignorar si no es posible
    }
  }
}
