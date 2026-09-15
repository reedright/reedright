export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}$/;
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 39);
}

export function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}
