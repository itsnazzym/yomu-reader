import React, { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import LottieView from "lottie-react-native";
import { IconBook, IconCheck, IconRefresh } from "@tabler/icons-react-native";
import { useReduceMotion } from "@/lib/reduceMotion";

const ANIMATIONS = {
  book: require("@/assets/animations/book-open.json"),
  loading: require("@/assets/animations/connecting.json"),
  success: require("@/assets/animations/connected.json"),
};

export function MotionGlyph({ kind, active = true, size = 60 }: {
  kind: keyof typeof ANIMATIONS;
  active?: boolean;
  size?: number;
}) {
  const reduced = useReduceMotion();
  const animation = useRef<LottieView>(null);
  const [foreground, setForeground] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [failed, setFailed] = useState(false);
  const playing = active && foreground && !reduced;
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const instance = animation.current;
    if (playing) instance?.play();
    else instance?.pause();
    return () => instance?.pause();
  }, [playing, kind]);
  const Icon = kind === "book" ? IconBook : kind === "success" ? IconCheck : IconRefresh;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    {reduced || failed ? <Icon size={size * 0.55} color="#d9dfe7" /> :
      <LottieView key={kind} ref={animation} source={ANIMATIONS[kind]} style={{ width: size, height: size }}
        autoPlay={false} loop={kind === "loading"} onAnimationFailure={() => setFailed(true)}
        onAnimationLoaded={() => { if (playing) animation.current?.play(); }} />}
  </View>;
}
