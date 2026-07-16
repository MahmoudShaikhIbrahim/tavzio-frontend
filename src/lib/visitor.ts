const VISITOR_ID_KEY = 'tavzio_visitor_id';

// A random id stored in this browser only - not a phone number, not a name,
// not a device fingerprint tied to hardware. Just "has this browser shown
// up before," which is what the backend uses to compute the anonymous
// new-vs-returning-visitor stat. Nothing about a person's identity is ever
// attached to it, and it's unrelated to the (separate, opt-in) loyalty
// program phone number.
export function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}
