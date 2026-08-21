export const FIREBASE_MESSAGING_SW_ACTIVATION_TIMEOUT_MS = 10000;

export function waitForServiceWorkerRegistrationActive(
  registration: ServiceWorkerRegistration,
  timeoutMs = FIREBASE_MESSAGING_SW_ACTIVATION_TIMEOUT_MS
): Promise<ServiceWorkerRegistration> {
  if (registration.active) return Promise.resolve(registration);

  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let trackedWorker: ServiceWorker | null = null;

    const cleanup = () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
      registration.removeEventListener("updatefound", onUpdateFound);
      trackedWorker?.removeEventListener("statechange", onStateChange);
    };

    const finish = () => {
      cleanup();
      resolve(registration);
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    const finishIfActive = () => {
      if (registration.active || trackedWorker?.state === "activated") {
        finish();
        return true;
      }
      return false;
    };

    function onStateChange() {
      if (finishIfActive()) return;
      if (trackedWorker?.state === "redundant") {
        fail("Firebase Messaging Service Worker ha quedat redundant abans d'activar-se");
      }
    }

    const trackWorker = (worker: ServiceWorker | null) => {
      trackedWorker?.removeEventListener("statechange", onStateChange);
      trackedWorker = worker;

      if (!trackedWorker) return;
      if (finishIfActive()) return;
      if (trackedWorker.state === "redundant") {
        fail("Firebase Messaging Service Worker ha quedat redundant abans d'activar-se");
        return;
      }

      trackedWorker.addEventListener("statechange", onStateChange);
    };

    function onUpdateFound() {
      trackWorker(registration.installing || registration.waiting || registration.active);
    }

    timeoutId = setTimeout(() => {
      fail("Timeout esperant l'activació del Firebase Messaging Service Worker");
    }, timeoutMs);

    registration.addEventListener("updatefound", onUpdateFound);
    trackWorker(registration.installing || registration.waiting || registration.active);
    finishIfActive();
  });
}
