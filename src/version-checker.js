export function startVersionChecker(currentVersion, { intervalMs = 30000 } = {}) {
  const check = async () => {
    try {
      const response = await fetch(`src/version.js?vcheck=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const text = await response.text();
      const match = text.match(/APP_VERSION\s*=\s*['\"]([^'\"]+)['\"]/);
      const remoteVersion = match?.[1];
      if (!remoteVersion || remoteVersion === currentVersion) return;
      const url = new URL(location.href);
      url.searchParams.set('appv', remoteVersion);
      location.replace(url.toString());
    } catch {
      // Version checks must never interfere with normal use.
    }
  };
  setTimeout(check, 2500);
  return setInterval(check, intervalMs);
}
