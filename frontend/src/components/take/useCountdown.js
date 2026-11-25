import { useEffect, useRef, useState } from 'react';

/** Seconds left until `deadline` (ms timestamp), or null without a deadline. Calls onExpire once. */
export function useCountdown(deadline, onExpire) {
  const compute = () => (deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null);
  const [secondsLeft, setSecondsLeft] = useState(compute);
  const expireRef = useRef(onExpire);
  const firedRef = useRef(false);
  expireRef.current = onExpire;

  useEffect(() => {
    firedRef.current = false;
    if (!deadline) {
      setSecondsLeft(null);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        expireRef.current?.();
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline]);

  return secondsLeft;
}
