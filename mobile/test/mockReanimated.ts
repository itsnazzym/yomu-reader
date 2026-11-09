import React from "react";

let lastValue = { value: 1 };
export function useSharedValue(value: number) {
  const ref = React.useRef({ value });
  lastValue = ref.current;
  return ref.current;
}
export function __getLastAnimatedValue() { return lastValue.value; }
export function useAnimatedStyle(update: () => unknown) { return update(); }
export const withTiming = (value: number) => value;
export const withSpring = (value: number) => value;
export const cancelAnimation = () => {};
export const ReduceMotion = { System: "system" };
export default { createAnimatedComponent: (component: unknown) => component };
