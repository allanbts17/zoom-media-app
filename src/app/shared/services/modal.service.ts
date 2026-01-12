import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ModalData } from '../../interfaces';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private resolver!: (value: boolean) => void;
  //private modalData = new BehaviorSubject<ModalData>({ show: false, title: '', message: '', confirm: false });
  modalData$ =  new BehaviorSubject<ModalData>({ show: false, title: '', message: '' });
  //this.modalData.asObservable();

  // modalVisible = false;
  // modalData = {
  //   title: '',
  //   message: ''
  // };

  confirm(title: string, message: string): Promise<boolean> {
    // this.modalData.title = title;
    // this.modalData.message = message;
    // this.modalVisible = true;
    this.modalData$.next({ show: true, title, message });

    return new Promise<boolean>((resolve) => {
      let subs = this.modalData$.subscribe(data => {
        if (data.confirm !== undefined) {
          subs.unsubscribe();
          resolve(data.confirm);
        }
      }) 
    });
  }

  // confirmAction() {
  //   this.modalVisible = false;
  //   this.resolver(true);
  // }

  // cancelAction() {
  //   this.modalVisible = false;
  //   this.resolver(false);
  // }
}
