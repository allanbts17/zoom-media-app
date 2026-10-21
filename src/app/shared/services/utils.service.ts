import { inject, Injectable } from '@angular/core';
import { HomeStateService } from '../../pages/home/home-state.service';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  //private state = inject(HomeStateService)

  canPauseResume(state: HomeStateService) {
    return state.botId && state.botAction != 'stop' && state.botAction != "" && state.botId != ''
  }


}
