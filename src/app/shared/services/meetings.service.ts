import { inject, Injectable } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp, collectionData, query, orderBy, where, getDocs, CollectionReference } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Meeting {
  id?: string;
  title?: string | null;
  url: string;
  createdAt?: any;
}

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

  async addMeeting(title: string, url: string): Promise<void> {
    // Validación básica de zoom URL
    if (!/^https?:\/\/([\w.-]+\.)?zoom\.us\/.+/i.test(url)) {
      throw new Error('Pega una URL válida de Zoom');
    }

    const data = await addDoc(this.meetingsCollection, {
      title: title?.trim() || null,
      url,
      createdAt: serverTimestamp(),
    });
    console.log('Meeting added with ID:', data.id);
  }
}
