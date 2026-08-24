import React, { useEffect, useRef } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const SNAP_SPRING = { damping: 22, stiffness: 220, mass: 0.7 } as const;

export interface ZoomablePageProps {
  children: React.ReactNode;
  enabled?: boolean;
  pinchEnabled?: boolean;
  doubleTapScale?: number;
  minScale?: number;
  maxScale?: number;
  resetToken?: number | string;
  onZoomChange?: (scale: number) => void;
  onSingleTap?: (x: number, y: number) => void;
}

const DEFAULT_MIN = 1;
const DEFAULT_MAX = 3.4;
const DEFAULT_DOUBLE_TAP = 1.85;

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

export function ZoomablePage({
  children,
  enabled = true,
  pinchEnabled = true,
  doubleTapScale = DEFAULT_DOUBLE_TAP,
  minScale = DEFAULT_MIN,
  maxScale = DEFAULT_MAX,
  resetToken,
  onZoomChange,
  onSingleTap,
}: ZoomablePageProps) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const boxW = useSharedValue(1);
  const boxH = useSharedValue(1);

  const onZoomChangeRef = useRef(onZoomChange);
  const onSingleTapRef = useRef(onSingleTap);
  onZoomChangeRef.current = onZoomChange;
  onSingleTapRef.current = onSingleTap;

  const notifyZoom = (next: number): void => {
    onZoomChangeRef.current?.(next);
  };

  const emitTap = (x: number, y: number): void => {
    onSingleTapRef.current?.(x, y);
  };

  const resetTransform = (animated: boolean): void => {
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    if (animated) {
      scale.value = withTiming(1, { duration: 180 });
      translateX.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(0, { duration: 180 });
    } else {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
    }
    notifyZoom(1);
  };

  useEffect(() => {
    resetTransform(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  const clampTranslation = (): void => {
    "worklet";
    const extraX = Math.max(0, (boxW.value * (scale.value - 1)) / 2);
    const extraY = Math.max(0, (boxH.value * (scale.value - 1)) / 2);
    translateX.value = clamp(translateX.value, -extraX, extraX);
    translateY.value = clamp(translateY.value, -extraY, extraY);
  };

  /** Spring snap vers les bords après pan/pinch (clamp animé). */
  const springSnapToEdges = (): void => {
    "worklet";
    const extraX = Math.max(0, (boxW.value * (scale.value - 1)) / 2);
    const extraY = Math.max(0, (boxH.value * (scale.value - 1)) / 2);
    const targetX = clamp(translateX.value, -extraX, extraX);
    const targetY = clamp(translateY.value, -extraY, extraY);
    translateX.value = withSpring(targetX, SNAP_SPRING);
    translateY.value = withSpring(targetY, SNAP_SPRING);
  };

  const pinch = Gesture.Pinch()
    .enabled(enabled && pinchEnabled)
    .onBegin(() => {
      startScale.value = scale.value;
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = clamp(startScale.value * event.scale, minScale, maxScale);
      const ratio = startScale.value > 0 ? next / startScale.value : 1;
      scale.value = next;
      translateX.value = event.focalX - (event.focalX - startX.value) * ratio;
      translateY.value = event.focalY - (event.focalY - startY.value) * ratio;
      clampTranslation();
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        scale.value = withSpring(1, SNAP_SPRING);
        translateX.value = withSpring(0, SNAP_SPRING);
        translateY.value = withSpring(0, SNAP_SPRING);
        runOnJS(notifyZoom)(1);
        return;
      }
      springSnapToEdges();
      runOnJS(notifyZoom)(scale.value);
    });

  const pan = Gesture.Pan()
    .enabled(enabled)
    .manualActivation(true)
    .onTouchesMove((_event, state) => {
      if (scale.value > 1.02) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1.02) return;
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
      clampTranslation();
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        translateX.value = withSpring(0, SNAP_SPRING);
        translateY.value = withSpring(0, SNAP_SPRING);
        return;
      }
      springSnapToEdges();
    });

  const doubleTap = Gesture.Tap()
    .enabled(enabled)
    .numberOfTaps(2)
    .maxDuration(280)
    .maxDelay(280)
    .maxDistance(22)
    .onEnd((event) => {
      if (scale.value > 1.05) {
        scale.value = withTiming(1, { duration: 180 });
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
        runOnJS(notifyZoom)(1);
        return;
      }
      const target = clamp(doubleTapScale, minScale + 0.2, maxScale);
      const originX = event.x - boxW.value / 2;
      const originY = event.y - boxH.value / 2;
      scale.value = withTiming(target, { duration: 180 });
      translateX.value = withTiming(-originX * (target - 1), { duration: 180 });
      translateY.value = withTiming(-originY * (target - 1), { duration: 180 });
      runOnJS(notifyZoom)(target);
    });

  const singleTap = Gesture.Tap()
    .enabled(enabled)
    .numberOfTaps(1)
    .maxDuration(220)
    .maxDistance(14)
    .onEnd((event) => {
      runOnJS(emitTap)(event.x, event.y);
    });

  const composed = Gesture.Simultaneous(
    pinch,
    Gesture.Exclusive(doubleTap, singleTap),
    pan
  );

  const animatedStyle = useAnimatedStyle(() => {
    const nextStyle: ViewStyle = {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
    return nextStyle;
  });

  if (!enabled) {
    return <View style={styles.fill}>{children}</View>;
  }

  return (
    <GestureDetector gesture={composed}>
      <View
        style={styles.fill}
        onLayout={(event) => {
          boxW.value = event.nativeEvent.layout.width || 1;
          boxH.value = event.nativeEvent.layout.height || 1;
        }}
      >
        <Animated.View style={[styles.fill as ViewStyle, animatedStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: "hidden",
  },
});
