import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeAgo',
  standalone: false,
  pure: true
})
export class TimeAgoPipe implements PipeTransform {
  transform(timestamp: number | undefined, format: 'short' | 'long' = 'short'): string {
    if (!timestamp) {
      return 'Never';
    }

    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
    
    if (format === 'long') {
      // For connection duration
      const minutes = Math.floor(secondsAgo / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      } else {
        return 'Just now';
      }
    } else {
      // For last ping
      if (secondsAgo < 10) {
        return 'Just now';
      } else if (secondsAgo < 60) {
        return `${secondsAgo}s ago`;
      } else {
        const minutesAgo = Math.floor(secondsAgo / 60);
        return `${minutesAgo}m ago`;
      }
    }
  }
}
