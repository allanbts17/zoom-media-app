import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeStore } from './home.store';
import { MeetingsPanelLayout } from '../../layout/meetings-panel/meetings-panel.layout';
import { GlobalActionsLayout } from '../../layout/global-actions/global-actions.layout';
import { SelectionBarLayout } from '../../layout/selection-bar/selection-bar.layout';
import { VideosTableLayout } from '../../layout/videos-table/videos-table.layout';
import { DriveImportLayout } from '../../layout/drive-import/drive-import.layout';

@Component({
  selector: 'app-home',
  imports: [CommonModule, MeetingsPanelLayout, GlobalActionsLayout, SelectionBarLayout,
    VideosTableLayout, DriveImportLayout],
  providers: [HomeStore],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css'
})
export class HomePage implements OnInit {
  store = inject(HomeStore);

  ngOnInit() {
    this.store.init();
  }
}
