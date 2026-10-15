import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeStore } from '../../pages/home/home.store';

/** Zoom meeting selection, bot controls, add meeting and add videos (local / Drive search). */
@Component({
  selector: 'app-meetings-panel',
  imports: [CommonModule, FormsModule],
  templateUrl: './meetings-panel.layout.html',
  styleUrl: './meetings-panel.layout.css'
})
export class MeetingsPanelLayout {
  store = inject(HomeStore);
}
