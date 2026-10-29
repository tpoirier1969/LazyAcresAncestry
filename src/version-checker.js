// Check the deployed release marker without using the browser's HTTP cache.
// The marker must be bumped whenever a new revision is published.
export function startVersionChecker(currentVersion, { intervalMs = 30000 } = {}) {
  let reloading = false;
  const attemptKey = 'lazy-acres-ancestry-update-attempt';
  const loadedRevision = new URL(import.meta.url).searchParams.get('appv');
  const check = async () => {
    if (reloading) return;
    try {
      const response = await fetch(new URL(`src/version.js?vcheck=${Date.now()}`, document.baseURI), {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const source = await response.text();
      const match = source.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
      const remoteVersion = match?.[1];
      if (!remoteVersion || remoteVersion === currentVersion) {
        if (remoteVersion === currentVersion) sessionStorage.removeItem(attemptKey);
        return;
      }
      // A stale cached module may continue reporting the old version after
      // navigation. Never repeatedly reload the same revision.
      const attempted = sessionStorage.getItem(attemptKey);
      if (attempted === remoteVersion || loadedRevision === remoteVersion) return;
      sessionStorage.setItem(attemptKey, remoteVersion);
      reloading = true;
      // Remove stale application assets, including any previously installed
      // service-worker cache, before reloading with a unique revision URL.
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations.map(reg => reg.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map(key => caches.delete(key)));
      }
      const url = new URL(location.href);
      url.searchParams.set('appv', remoteVersion);
      url.searchParams.delete('refresh');
      location.replace(url.toString());
    } catch {
      reloading = false;
      // An offline version check must never interrupt normal use.
    }
  };
  setTimeout(check, 2500);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) check();
  });
  return setInterval(check, intervalMs);
}
