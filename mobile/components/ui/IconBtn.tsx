import React, { useRef, useCallback } from "react";
import {
  TouchableOpacity,
  StyleProp,
  StyleSheet,
  ViewStyle,
  Animated,
  View,
} from "react-native";

export interface IconBtnProps {
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
  size = 40,
  style,
  disabled,
  highlightColor = "rgba(197,135,141,0.18)",
}: IconBtnProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  const onPressIn = useCallback(() => {
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
  }, [scale, bgOpacity]);

  const onPressOut = useCallback(() => {
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
  }, [scale, bgOpacity]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
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
              backgroundColor: highlightColor,
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
