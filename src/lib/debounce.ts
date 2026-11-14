/** Runs `run` with the latest value `delay` ms after the last `schedule`, or at once on `flush`. */
export const debounced = <T>(run: (value: T) => void, delay: number) => {
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    if (pending) run(pending.value);
    pending = null;
  };
  const schedule = (value: T) => {
    pending = { value };
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  };
  return { schedule, flush };
};
