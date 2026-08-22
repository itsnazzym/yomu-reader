import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

let reduceMotionEnabled = false;
const listeners = new Set<(enabled: boolean) => void>();

function setReduceMotion(enabled: boolean): void {
  if (reduceMotionEnabled === enabled) return;
  reduceMotionEnabled = enabled;
  for (const listener of listeners) listener(enabled);
}

AccessibilityInfo.isReduceMotionEnabled()
  .then((enabled) => {
    setReduceMotion(Boolean(enabled));
  })
  .catch(() => {});

const reduceMotionSub = AccessibilityInfo.addEventListener(
  "reduceMotionChanged",
  (enabled: boolean) => {
    setReduceMotion(Boolean(enabled));
  }
);

void reduceMotionSub;

export function getReduceMotion(): boolean {
  return reduceMotionEnabled;
}

export function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(reduceMotionEnabled);

  useEffect(() => {
    const update = (next: boolean): void => {
      setEnabled(next);
    };
    listeners.add(update);
    update(reduceMotionEnabled);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return enabled;
}
