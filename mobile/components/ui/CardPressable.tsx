import React, { useEffect, useCallback } from "react";
import {
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  StyleSheet,
  type GestureResponderEvent,
  type TouchableOpacityProps,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, cancelAnimation, ReduceMotion } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/reduceMotion";

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Échelle au press pour les petites puces cliquables (chips, tags, lignes).
 * Centralisée ici pour que les appels n'aient pas à répéter le réglage.
 */
export const CHIP_PRESSED_SCALE = 0.91;

export interface CardPressableProps
  extends Omit<TouchableOpacityProps, "style" | "children" | "onPress"> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  activeOpacity?: number;
  /** Rebond tactile plus compact pour les puces que pour les cartes. */
  variant?: "card" | "chip";
  pressedScale?: number;
  onPress?: (e?: GestureResponderEvent) => void;
  disabled?: boolean;
}

export function CardPressable({
  children,
  style,
  radius = 12,
  activeOpacity = 0.85,
  variant = "card",
  pressedScale = variant === "chip" ? CHIP_PRESSED_SCALE : 0.94,
  onPress,
  disabled,
  onPressIn: suppliedPressIn,
  onPressOut: suppliedPressOut,
  ...rest
}: CardPressableProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReduceMotion();
  const transform = StyleSheet.flatten(style)?.transform;

  useEffect(() => {
    if (reduceMotion || disabled) { cancelAnimation(scale); scale.value = 1; }
    return () => cancelAnimation(scale);
  }, [reduceMotion, disabled, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: typeof transform === "string" ? transform : [...(transform || []), { scale: scale.value }],
  }));

  const onPressIn = useCallback((event: GestureResponderEvent) => {
    if (disabled) return;
    if (!reduceMotion) scale.value = withTiming(pressedScale, { duration: 100, reduceMotion: ReduceMotion.System });
    suppliedPressIn?.(event);
  }, [disabled, scale, pressedScale, reduceMotion, suppliedPressIn]);

  const onPressOut = useCallback((event: GestureResponderEvent) => {
    if (disabled) return;
    if (reduceMotion) {
      scale.value = 1;
    } else scale.value = withSpring(1, { damping: 16, stiffness: 260, mass: 0.7, reduceMotion: ReduceMotion.System });
    suppliedPressOut?.(event);
  }, [disabled, scale, reduceMotion, suppliedPressOut]);

  return (
    <AnimatedTouchableOpacity
      activeOpacity={activeOpacity}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        { borderRadius: radius, opacity: disabled ? 0.5 : 1 },
        style,
        animatedStyle,
      ]}
      {...rest}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
}

export default CardPressable;
