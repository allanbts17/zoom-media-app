import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Observable } from 'rxjs';
import { ModalService } from '../../services/modal.service';
import { ModalData } from '../../../interfaces';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.component.html',
  styleUrls: ['./confirm-modal.component.css'],
  imports: [CommonModule],
})
export class ConfirmModalComponent {
  modalData$: Observable<ModalData>;
  constructor(private modalService: ModalService) {
    this.modalData$ = modalService.modalData$;
  }

  confirmAction(confirm: boolean) {
    this.modalService.modalData$.next({ show: false, title: '', message: '', confirm });
  }
}
