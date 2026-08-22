import React, { useRef, useCallback } from "react";
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
  Animated,
} from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { useReduceMotion } from "@/lib/reduceMotion";

export interface IconBtnProps
  extends Pick<
    TouchableOpacityProps,
    "accessibilityLabel" | "accessibilityHint" | "accessibilityRole" | "hitSlop"
  > {
  onPress?: () => void;
  children?: React.ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  highlightColor?: string;
}

export function IconBtn({
  onPress,
  children,
  size = 44,
  style,
  disabled,
  highlightColor,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = "button",
  hitSlop = 4,
}: IconBtnProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const effectiveHighlightColor = highlightColor ?? `${colors.accent}2E`;
  const scale = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  const onPressIn = useCallback(() => {
    if (reduceMotion) {
      bgOpacity.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.88,
        useNativeDriver: true,
        speed: 60,
        bounciness: 4,
      }),
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, bgOpacity, reduceMotion]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) {
      bgOpacity.setValue(0);
      scale.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 60,
        bounciness: 6,
      }),
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, bgOpacity, reduceMotion]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      hitSlop={hitSlop}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View
        style={[
          styles.btn,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale }],
          },
          style,
        ]}
      >
        {/* Highlight background on press */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: size / 2,
              backgroundColor: effectiveHighlightColor,
              opacity: bgOpacity,
            },
          ]}
          pointerEvents="none"
        />
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

export default IconBtn;
