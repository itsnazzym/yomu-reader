import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  PanResponder,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useTheme } from "@/lib/ThemeContext";

export interface SmoothSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (val: number) => void;
  onSlidingComplete?: (val: number) => void;
  style?: StyleProp<ViewStyle>;
  trackColor?: string;
  activeColor?: string;
  thumbColor?: string;
}

export function SmoothSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  onSlidingComplete,
  style,
  trackColor,
  activeColor,
  thumbColor,
}: SmoothSliderProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [currentVal, setCurrentVal] = useState(value);
  const isDragging = useRef(false);
  const widthRef = useRef(0);
  const currentValRef = useRef(value);
  const updateFromPositionRef = useRef<(touchX: number) => number>(() => value);
  const onSlidingCompleteRef = useRef(onSlidingComplete);

  currentValRef.current = currentVal;
  onSlidingCompleteRef.current = onSlidingComplete;

  useEffect(() => {
    if (!isDragging.current) {
      setCurrentVal(value);
    }
  }, [value]);

  const snapValue = useCallback(
    (raw: number) => {
      const clamped = Math.max(min, Math.min(max, raw));
      if (!step || step <= 0) return clamped;
      const stepped = Math.round((clamped - min) / step) * step + min;
      return Math.max(min, Math.min(max, stepped));
    },
    [min, max, step]
  );

  const range = max - min;

  const updateFromPosition = useCallback(
    (touchX: number) => {
      if (widthRef.current <= 0) return currentValRef.current;
      const ratio = Math.max(0, Math.min(1, touchX / widthRef.current));
      const rawVal = range > 0 ? min + ratio * range : min;
      const snapped = snapValue(rawVal);
      setCurrentVal(snapped);
      onValueChange?.(snapped);
      return snapped;
    },
    [min, range, snapValue, onValueChange]
  );
  updateFromPositionRef.current = updateFromPosition;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        const x = evt.nativeEvent.locationX;
        updateFromPositionRef.current(x);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        updateFromPositionRef.current(x);
      },
      onPanResponderRelease: (evt) => {
        isDragging.current = false;
        const x = evt.nativeEvent.locationX;
        const finalVal = updateFromPositionRef.current(x);
        onSlidingCompleteRef.current?.(finalVal);
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        onSlidingCompleteRef.current?.(currentValRef.current);
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    widthRef.current = w;
  };

  const activePercent = range > 0
    ? Math.max(0, Math.min(100, ((currentVal - min) / range) * 100))
    : 0;
  const effectiveActive = activeColor || colors.accent;
  const effectiveTrack = trackColor || "#252535";
  const effectiveThumb = thumbColor || colors.accent;

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {/* Background Track */}
      <View style={[styles.track, { backgroundColor: effectiveTrack }]}>
        {/* Active Track */}
        <View
          style={[
            styles.activeTrack,
            { width: `${activePercent}%`, backgroundColor: effectiveActive },
          ]}
        />
      </View>

      {/* Thumb */}
      {width > 0 && (
        <View
          style={[
            styles.thumb,
            {
              left: `${activePercent}%`,
              backgroundColor: effectiveThumb,
              borderColor: "#161622",
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 38,
    justifyContent: "center",
    position: "relative",
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    width: "100%",
  },
  activeTrack: {
    height: "100%",
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginLeft: -10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
});

export default SmoothSlider;
