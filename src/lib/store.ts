/**
 * A value that a few components read through `useSyncExternalStore`, so a change re-renders only
 * them. For values that change on every pointer move, where React state would re-render the stage.
 */
export const createStore = <T>(initial: T) => {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export type Store<T> = ReturnType<typeof createStore<T>>;
