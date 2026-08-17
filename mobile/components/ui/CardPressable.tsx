import React, { useRef, useCallback } from "react";
import {
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Animated,
} from "react-native";

export interface CardPressableProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  activeOpacity?: number;
  pressedScale?: number;
  onPress?: (e?: any) => void;
  disabled?: boolean;
  [key: string]: any;
}

export function CardPressable({
  children,
  style,
  radius = 12,
  activeOpacity = 0.85,
  pressedScale = 0.97,
  onPress,
  disabled,
  ...rest
}: CardPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: pressedScale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 2,
    }).start();
  }, [scale, pressedScale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={{ opacity: disabled ? 0.5 : 1 }}
      {...rest}
    >
      <Animated.View
        style={[
          {
            borderRadius: radius,
            transform: [{ scale }],
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default CardPressable;
