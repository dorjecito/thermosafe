type ServiceWorkerContainerLike = Pick<
  ServiceWorkerContainer,
  "addEventListener" | "removeEventListener" | "controller" | "getRegistrations"
>;

export const SERVICE_WORKER_UPDATE_WAIT_MS = 1500;

type ServiceWorkerRegistrationLike = Awaited<
  ReturnType<ServiceWorkerContainerLike["getRegistrations"]>
>[number];

function waitForControllerChange(
  serviceWorker: ServiceWorkerContainerLike,
  timeoutMs = SERVICE_WORKER_UPDATE_WAIT_MS
): Promise<void> {
  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
      serviceWorker.removeEventListener("controllerchange", finish);
      resolve();
    };

    timeoutId = setTimeout(finish, timeoutMs);
    serviceWorker.addEventListener("controllerchange", finish);
  });
}

export async function prepareServiceWorkerForVersionReload(
  serviceWorker: ServiceWorkerContainerLike | null | undefined,
  timeoutMs = SERVICE_WORKER_UPDATE_WAIT_MS
): Promise<void> {
  if (!serviceWorker?.getRegistrations) return;

  const registrations = await serviceWorker.getRegistrations();
  if (!registrations.length) return;

  const controllerChange = serviceWorker.controller
    ? waitForControllerChange(serviceWorker, timeoutMs)
    : Promise.resolve();

  await Promise.allSettled(
    registrations.map(async (registration) => {
      await registration.update();
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    })
  );

  await controllerChange;
}

function isAppShellServiceWorker(registration: ServiceWorkerRegistrationLike) {
  const scriptUrls = [
    registration.active?.scriptURL,
    registration.waiting?.scriptURL,
    registration.installing?.scriptURL,
  ];

  return scriptUrls.some((scriptUrl) => {
    if (!scriptUrl) return false;
    try {
      return new URL(scriptUrl).pathname === "/sw.js";
    } catch {
      return scriptUrl.endsWith("/sw.js");
    }
  });
}

export async function unregisterAppShellServiceWorkers(
  serviceWorker: ServiceWorkerContainerLike | null | undefined
): Promise<void> {
  if (!serviceWorker?.getRegistrations) return;

  const registrations = await serviceWorker.getRegistrations();

  await Promise.allSettled(
    registrations
      .filter(isAppShellServiceWorker)
      .map((registration) => registration.unregister())
  );
}

export async function reloadThermoSafeVersion(
  options: {
    serviceWorker?: ServiceWorkerContainerLike | null;
    reload?: () => void;
    timeoutMs?: number;
  } = {}
): Promise<void> {
  const serviceWorker =
    options.serviceWorker ??
    (typeof navigator !== "undefined" ? navigator.serviceWorker : null);
  const reload =
    options.reload ??
    (() => {
      window.location.reload();
    });

  try {
    await prepareServiceWorkerForVersionReload(
      serviceWorker,
      options.timeoutMs ?? SERVICE_WORKER_UPDATE_WAIT_MS
    );
    await unregisterAppShellServiceWorkers(serviceWorker);
  } finally {
    reload();
  }
}
