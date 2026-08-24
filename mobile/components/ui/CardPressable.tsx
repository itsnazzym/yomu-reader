import React, { useRef, useCallback } from "react";
import {
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Animated,
  type GestureResponderEvent,
  type TouchableOpacityProps,
} from "react-native";
import { useReduceMotion } from "@/lib/reduceMotion";

/**
 * Échelle au press pour les petites puces cliquables (chips, tags, lignes).
 * Centralisée ici pour que les appels n'aient pas à répéter le réglage.
 */
export const CHIP_PRESSED_SCALE = 0.93;

export interface CardPressableProps
  extends Omit<TouchableOpacityProps, "style" | "children" | "onPress"> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  activeOpacity?: number;
  /** "card" (défaut) : échelle douce ; "chip" : échelle 0.93 (puce/tag). */
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
  pressedScale = variant === "chip" ? CHIP_PRESSED_SCALE : 0.97,
  onPress,
  disabled,
  ...rest
}: CardPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();

  const onPressIn = useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: pressedScale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 2,
    }).start();
  }, [scale, pressedScale, reduceMotion]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale, reduceMotion]);

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
      {...rest}
    >
      <Animated.View
        style={{
          borderRadius: radius,
          transform: [{ scale }],
          alignSelf: "stretch",
          width: "100%",
        }}
      >
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default CardPressable;
