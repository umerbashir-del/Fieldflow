export async function runAbortableRequest(start, { label = 'Request', timeoutMs = 10_000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const result = await start(controller.signal);
    if (timedOut) throw new Error(`${label} timed out and was cancelled.`);
    return result;
  } catch (error) {
    if (timedOut) throw new Error(`${label} timed out and was cancelled.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
