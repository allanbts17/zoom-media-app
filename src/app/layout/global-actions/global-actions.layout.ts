import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeStore } from '../../pages/home/home.store';

/** Stop playback, active list selector/delete and reorder controls. */
@Component({
  selector: 'app-global-actions',
  imports: [CommonModule, FormsModule],
  templateUrl: './global-actions.layout.html',
  styleUrl: './global-actions.layout.css'
})
export class GlobalActionsLayout {
  store = inject(HomeStore);
}
