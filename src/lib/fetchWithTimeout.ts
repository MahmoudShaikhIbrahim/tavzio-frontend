// A plain fetch() has no timeout at all - a hung network request (bad
// connection, unresponsive backend) leaves whoever's waiting stuck
// indefinitely, with no error, no fallback, nothing. This wraps fetch with
// a hard timeout so every call in the app fails cleanly instead - the
// difference between "an error appeared" and "the page is just frozen
// forever with no indication why."
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
