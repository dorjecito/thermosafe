export function withAbortTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Request timed out"));
    }, timeoutMs);
  });

  return Promise.race([operation(controller.signal), timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
