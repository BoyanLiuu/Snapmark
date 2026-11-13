/** Add `value` to the set, or remove it if it is there. */
export const toggle = <T>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
};
