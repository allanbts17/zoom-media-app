import { inject, Injectable } from '@angular/core';
import { Firestore, collection, doc, deleteDoc, addDoc, serverTimestamp, collectionData, query, orderBy, where, getDocs, CollectionReference } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Meeting } from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class MeetingsService {
  private firestore = inject(Firestore);
  meetings$: Observable<Meeting[]>;
  meetingsCollection: CollectionReference<Meeting>;
  constructor() {
    this.meetingsCollection = collection(this.firestore, 'meetings') as CollectionReference<Meeting>;
    const q = query(this.meetingsCollection, orderBy('createdAt', 'desc'));
    this.meetings$ = collectionData(q, { idField: 'id' }) as Observable<Meeting[]>;
  }

  convertUrl(url: string) {
    if (/^https?:\/\/([\w.-]+\.)?zoom\.us\/.+/i.test(url)) {
      const parsed = new URL(url);
      const meetingNumber = parsed.pathname.split('/')[2]
      url = meetingNumber
    } else {
      throw new Error('Pega una URL válida de Zoom');
    }
    return url
  }

  async addMeeting(title: string, number: string, password: string): Promise<void> {
    const data = await addDoc(this.meetingsCollection, {
      title: title?.trim() || null,
      number: number,
      password: password || null,
      createdAt: serverTimestamp(),
    });
    console.log('Meeting added with ID:', data.id);
  }
  async deleteMeeting(id: string): Promise<void> {
    await deleteDoc(doc(this.meetingsCollection, id));
  }
}
