import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration'
})
export class DurationPipe implements PipeTransform {

  transform(value: number): string {
    let minutes: number = Math.floor(value / 60);
    let seconds: number = Math.floor(value % 60); 
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

}
