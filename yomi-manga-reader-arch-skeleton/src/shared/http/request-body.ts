/**
 * Reading an untrusted JSON request body.
 *
 * `Request.json()` is typed `Promise<any>`, so assigning its result straight into a declared
 * shape is an `any` flowing into the rest of the handler — which is how `body.chapterId`
 * becomes an unchecked member access. The value is therefore read as `unknown` first and
 * only then given the shape the handler declares, so the declared fields are the ones the
 * handler can see and every one of them is still untrusted.
 *
 * `undefined` means "the body was not valid JSON"; the caller decides the status code.
 */
export async function readJsonBody<T extends object>(request: Request): Promise<T | undefined> {
  const raw: unknown = await request.json();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  return raw as T;
}
