import { inject, Injectable } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp, collectionData, query, orderBy, CollectionReference, updateDoc, doc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { VideoList } from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class VideoListsService {
  private firestore = inject(Firestore);
  lists$: Observable<VideoList[]>;
  listsCollection: CollectionReference<VideoList>;

  constructor() {
    this.listsCollection = collection(this.firestore, 'lists') as CollectionReference<VideoList>;
    const q = query(this.listsCollection, orderBy('createdAt', 'desc'));
    this.lists$ = collectionData(q, { idField: 'id' }) as Observable<VideoList[]>;
  }

  async addList(name: string, videoPaths: string[] = []): Promise<void> {
    const data = await addDoc(this.listsCollection, {
      name: name?.trim() || 'Nueva Lista',
      videoPaths,
      createdAt: serverTimestamp(),
    });
    console.log('List added with ID:', data.id);
  }

  async updateList(id: string, updates: Partial<VideoList>): Promise<void> {
    const listDoc = doc(this.firestore, 'lists', id);
    await updateDoc(listDoc, updates);
  }

  async deleteList(id: string): Promise<void> {
    const listDoc = doc(this.firestore, 'lists', id);
    await deleteDoc(listDoc);
  }
}
