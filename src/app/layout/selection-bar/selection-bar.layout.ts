import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeStateService } from '../../pages/home/home-state.service';
import { BackendService } from '../../shared/services/backend.service';
import { LoadingService } from '../../shared/services/loading.service';
import { ModalService } from '../../shared/services/modal.service';
import { VideoListsService } from '../../shared/services/video-lists.service';
import { VideoItem } from '../../shared/interfaces';

/** Bulk actions over the selected videos (create list, add/remove from list, delete). */
@Component({
  selector: 'app-selection-bar',
  imports: [CommonModule, FormsModule],
  templateUrl: './selection-bar.layout.html',
  styleUrl: './selection-bar.layout.css'
})
export class SelectionBarLayout {
  readonly state = inject(HomeStateService);
  private readonly backend = inject(BackendService);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ModalService);
  private readonly videoListsService = inject(VideoListsService);

  newListTitle = '';

  selectedList(): VideoItem[] {
    return this.state.videos.filter(v => this.state.selectedMap[v.videoPath]);
  }

  async createNewList() {
    const queue = this.selectedList();
    if (queue.length === 0) return;
    if (!this.newListTitle.trim()) {
      this.state.err = 'Ingresa un nombre para la nueva lista';
      return;
    }
    this.state.err = '';
    this.loadingService.show();
    try {
      const paths = queue.map(v => v.videoPath);
      await this.videoListsService.addList(this.newListTitle, paths);
      this.newListTitle = '';
      this.state.selectedMap = {}; // clear selection
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error creando lista';
    } finally {
      this.loadingService.hide();
    }
  }

  async addSelectedToList(listId: string) {
    const queue = this.selectedList();
    if (queue.length === 0 || !listId) return;

    const targetList = this.state.videoLists.find(l => l.id === listId);
    if (!targetList || !targetList.id) return;

    this.loadingService.show();
    try {
      const newPaths = [...targetList.videoPaths];
      queue.forEach(v => {
        if (!newPaths.includes(v.videoPath)) {
          newPaths.push(v.videoPath);
        }
      });
      await this.videoListsService.updateList(targetList.id, { videoPaths: newPaths });
      this.state.selectedMap = {}; // clear selection
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error agregando a la lista';
    } finally {
      this.loadingService.hide();
    }
  }

  async removeSelectedFromCurrentList() {
    if (this.state.activeListId() === 'all') return;
    const queue = this.selectedList();
    if (queue.length === 0) return;

    const activeList = this.state.videoLists.find(l => l.id === this.state.activeListId());
    if (!activeList || !activeList.id) return;

    this.loadingService.show();
    try {
      const pathsToRemove = queue.map(v => v.videoPath);
      const newPaths = activeList.videoPaths.filter(p => !pathsToRemove.includes(p));
      await this.videoListsService.updateList(activeList.id, { videoPaths: newPaths });
      this.state.selectedMap = {};
    } catch (e: any) {
      this.state.err = e?.message ?? 'Error removiendo de la lista';
    } finally {
      this.loadingService.hide();
    }
  }

  async deletedSelectedVideos() {

    let confirm = await this.confirmService.confirm('Confirmación', '¿Seguro que quieres borrar?')
    if (!confirm) return;

    const selected = this.selectedList()
    console.log('Delete selected videos:', selected);
    this.loadingService.show();
    for (const v of selected) {
      await this.backend.deleteVideo(v)
    }
    this.loadingService.hide();
  }

}
