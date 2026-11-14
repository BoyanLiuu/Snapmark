/** Add `value` to the set, or remove it if it is there. */
export const toggle = <T>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
};

/** The same for a list, keeping its order: `value` added at the end, or taken out. */
export const toggleIn = <T>(list: readonly T[], value: T): T[] =>
  list.includes(value)
    ? list.filter((other) => other !== value)
    : [...list, value];
