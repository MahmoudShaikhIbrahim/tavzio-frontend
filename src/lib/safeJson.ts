// A non-2xx AND a successful-but-broken deploy can both return an HTML
// error page instead of JSON (Railway/Vercel outage pages, gateway
// timeouts, etc.). Calling res.json() directly on that throws a raw,
// confusing browser parse exception straight into the UI - this turns
// it into one clear, human message instead.
export async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    throw new Error('The server is temporarily unavailable — please try again in a moment.');
  }
}
