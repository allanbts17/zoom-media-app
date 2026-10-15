import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeStore } from '../../pages/home/home.store';

/** Bulk actions over the selected videos (create list, add/remove from list, delete). */
@Component({
  selector: 'app-selection-bar',
  imports: [CommonModule, FormsModule],
  templateUrl: './selection-bar.layout.html',
  styleUrl: './selection-bar.layout.css'
})
export class SelectionBarLayout {
  store = inject(HomeStore);
}
