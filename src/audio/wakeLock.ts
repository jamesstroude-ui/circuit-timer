// Keeps the screen on with the Screen Wake Lock API.
// The browser drops the lock when the app is hidden, so we ask again when it is visible.

type Listener = (status: string) => void;

let sentinel: WakeLockSentinel | null = null;
let wanted = false;
let listener: Listener = () => undefined;

export function wakeLockSupported(): boolean {
  return 'wakeLock' in navigator;
}

async function acquire(): Promise<void> {
  if (!wakeLockSupported()) {
    listener('not supported');
    return;
  }
  try {
    sentinel = await navigator.wakeLock.request('screen');
    listener('active');
    sentinel.addEventListener('release', () => {
      sentinel = null;
      listener(wanted ? 'released (will retry when visible)' : 'off');
    });
  } catch (e) {
    listener(`error: ${(e as Error).name} ${(e as Error).message}`);
  }
}

function onVisibility(): void {
  if (wanted && document.visibilityState === 'visible' && !sentinel) void acquire();
}

/** Call inside the Start tap. */
export function startWakeLock(onStatus: Listener): void {
  listener = onStatus;
  wanted = true;
  document.addEventListener('visibilitychange', onVisibility);
  void acquire();
}

export function stopWakeLock(): void {
  wanted = false;
  document.removeEventListener('visibilitychange', onVisibility);
  void sentinel?.release();
  sentinel = null;
  listener('off');
}
