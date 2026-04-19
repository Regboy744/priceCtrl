/**
 * PostgREST ilike treats `%` and `_` as wildcards and `\` as an escape char.
 * User-supplied search input needs them escaped or a query like `foo%bar`
 * turns into an open-ended scan, and `_` matches any single character —
 * producing wrong results and unnecessarily expensive queries.
 */
export function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
