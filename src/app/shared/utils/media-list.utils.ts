import type { VideoList } from '../interfaces/video';
export function normalizeMediaList(list: VideoList): VideoList {
  return {...list, videoPaths:list.videoPaths ?? [], audioPaths:list.audioPaths ?? [], docPaths:list.docPaths ?? []};
}
/** Replace visible positions only, keeping filtered-out files in place. */
export function reorderVisiblePaths(allPaths: readonly string[], visiblePaths: readonly string[], previous: number, current: number): string[] {
  const visible = [...visiblePaths];
  if (previous < 0 || current < 0 || previous >= visible.length || current >= visible.length) return [...allPaths];
  const [moved] = visible.splice(previous,1); visible.splice(current,0,moved);
  const included = new Set(visible); let index = 0;
  return allPaths.map(path => included.has(path) ? visible[index++] : path);
}
