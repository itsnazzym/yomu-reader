import { useEffect, useState } from "react";
import type { ViewStyle } from "react-native";
import { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/reduceMotion";

/** Retain the native window until its exit finishes; reopening cancels that exit. */
export function useModalMotion(visible: boolean) {
  const [presented, setPresented] = useState(visible);
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) setPresented(true);
    progress.value = withTiming(visible ? 1 : 0, {
      duration: reduced ? 80 : visible ? 460 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
    }, (finished) => {
      if (finished && !visible) runOnJS(setPresented)(false);
    });
    return () => cancelAnimation(progress);
  }, [visible, reduced, progress]);

  const backdropStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: progress.value,
    transform: [
      { translateY: reduced ? 0 : (1 - progress.value) * 100 },
      { scale: reduced ? 1 : 0.92 + progress.value * 0.08 },
    ] as const,
  }));
  return { presented, backdropStyle, cardStyle };
}
