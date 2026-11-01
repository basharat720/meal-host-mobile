import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Tracks the OS "reduce motion" setting, following later changes to it. */
export const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);

  return reduced;
};

interface TypewriterOptions {
  /** Milliseconds per character. */
  typeMs?: number;
  /** How long a finished phrase stays before the next one starts. */
  holdMs?: number;
  /** Pauses the cycle and shows the current phrase whole. */
  enabled?: boolean;
}

/**
 * Types each phrase out a character at a time, holds it, then moves to the
 * next and loops — the website's hook, ported.
 *
 * Returns the phrase whole — never a fragment — when the user has asked for
 * reduced motion, or when `enabled` is false. Callers disable it when the
 * animation is not being looked at, such as an input whose placeholder is
 * hidden because it already has a value.
 */
export const useTypewriter = (
  phrases: string[],
  { typeMs = 55, holdMs = 2000, enabled = true }: TypewriterOptions = {}
) => {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");

  const count = phrases.length;
  const full = phrases[index] ?? "";
  const animating = enabled && !reduced && count > 0;

  useEffect(() => {
    if (count === 0) return;

    if (!animating) {
      setTyped(full);
      return;
    }

    if (typed === full) {
      const hold = setTimeout(() => {
        setTyped("");
        setIndex((i) => (i + 1) % count);
      }, holdMs);
      return () => clearTimeout(hold);
    }

    const tick = setTimeout(() => setTyped(full.slice(0, typed.length + 1)), typeMs);
    return () => clearTimeout(tick);
    // `full` and `count` are a string and a number, so this stays stable even
    // though the caller rebuilds the phrases array on every render.
  }, [typed, full, count, animating, typeMs, holdMs]);

  return { text: typed, animating };
};
