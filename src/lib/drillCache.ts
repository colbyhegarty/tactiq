import { LibraryDrillMeta, fetchLibraryDrills } from './api';

let cached: LibraryDrillMeta[] | null = null;
let fetchFailed = false;
let promise: Promise<LibraryDrillMeta[]> | null = null;

export function prefetchDrills(): Promise<LibraryDrillMeta[]> {
  if (promise) return promise;
  promise = fetchLibraryDrills().then(res => {
    if (res.success) {
      cached = res.drills;
      return res.drills;
    }
    fetchFailed = true;
    return [];
  }).catch(() => {
    fetchFailed = true;
    return [];
  });
  return promise;
}

export function getCachedDrills(): LibraryDrillMeta[] | null {
  return cached;
}

export function awaitPrefetch(): Promise<LibraryDrillMeta[]> {
  return promise ?? prefetchDrills();
}

export function didPrefetchFail(): boolean {
  return fetchFailed;
}

export function clearCache() {
  cached = null;
  fetchFailed = false;
  promise = null;
}
