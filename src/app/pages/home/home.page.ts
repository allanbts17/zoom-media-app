import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { UserMenuComponent } from '../../shared/components/user-menu/user-menu.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HomeStateService } from './home-state.service';
import { BackendService } from '../../shared/services/backend.service';
import { VideoListsService } from '../../shared/services/video-lists.service';
import { MeetingsPanelLayout } from '../../layout/meetings-panel/meetings-panel.layout';
import { GlobalActionsLayout } from '../../layout/global-actions/global-actions.layout';
import { SelectionBarLayout } from '../../layout/selection-bar/selection-bar.layout';
import { VideosTableLayout } from '../../layout/videos-table/videos-table.layout';
import { DriveImportLayout } from '../../layout/drive-import/drive-import.layout';
import { ZoomBotService } from '../../shared/services/zoom-bot.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, MeetingsPanelLayout, GlobalActionsLayout, SelectionBarLayout,
    VideosTableLayout, DriveImportLayout, UserMenuComponent],
  providers: [HomeStateService],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css'
})
export class HomePage implements OnInit {
  readonly state = inject(HomeStateService);
  private readonly backend = inject(BackendService);
  private readonly videoListsService = inject(VideoListsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  //private readonly zoom = inject(ZoomBotService);

  constructor() {
    effect(() => {
      if (!this.auth.user()) void this.router.navigateByUrl('/', { replaceUrl: true });
    });
  }

  ngOnInit() {
    this.backend.videos$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => { this.state.videos = list; this.state.loading = false; },
      error: error => { this.state.err = error?.message ?? 'Error cargando videos'; this.state.loading = false; },
    });
    this.backend.configData$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: config => {
        this.state.botId = config?.botId ?? '';
        this.state.busyRow = config?.busyRow ?? '';
        this.state.playing = config?.playing ?? false;
        this.state.globalVideoOrder = config?.globalVideoOrder ?? [];
        this.state.botMaxSessionSeconds = config?.botMaxSessionSeconds as number;
        this.state.botWaitingRoomTimeoutSeconds = config?.botWaitingRoomTimeoutSeconds as number;
      },
      error: error => this.state.err = error?.message ?? 'Error cargando configuración',
    });
    this.videoListsService.lists$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: lists => this.state.videoLists = lists,
      error: error => this.state.err = error?.message ?? 'Error leyendo listas',
    });
  }
}
