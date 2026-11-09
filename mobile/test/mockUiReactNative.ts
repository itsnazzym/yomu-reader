import React from "react";

export function TouchableOpacity({ children, style, disabled, accessibilityLabel }: Record<string, any>) {
  return React.createElement("button", { "data-style": JSON.stringify(StyleSheet.flatten(style)), disabled, "aria-label": accessibilityLabel }, children);
}
export function Text({ children, numberOfLines, adjustsFontSizeToFit, maxFontSizeMultiplier }: Record<string, any>) {
  return React.createElement("span", { "data-lines": numberOfLines, "data-shrinks": adjustsFontSizeToFit ? "yes" : undefined, "data-font-limit": maxFontSizeMultiplier }, children);
}
export const StyleSheet = {
  flatten(style: any): any {
    return Array.isArray(style) ? Object.assign({}, ...style.map(StyleSheet.flatten)) : style || {};
  },
};
export const Animated = {
  Value: class { constructor(public value: number) {} setValue(value: number) { this.value = value; } },
  createAnimatedComponent: (component: any) => component,
};
export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  addEventListener: () => ({ remove() {} }),
};
