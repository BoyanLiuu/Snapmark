import { useEffect, useRef } from "react";

/** A ref that always holds the latest `value`: for values the render loop reads during a frame. */
export const useRefValue = <T>(value: T) => {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
};
