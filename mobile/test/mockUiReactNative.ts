import React from "react";

export const Platform = { OS: "android" };
export function View({ children, style }: Record<string, any>) {
  return React.createElement("div", { "data-style": JSON.stringify(StyleSheet.flatten(style)) }, children);
}

let touchHandlers: Record<string, any> = {};
export function __getTouchHandlers() { return touchHandlers; }
export function TouchableOpacity({ children, style, disabled, accessibilityLabel, ...rest }: Record<string, any>) {
  touchHandlers = rest;
  return React.createElement("button", { "data-style": JSON.stringify(StyleSheet.flatten(style)), disabled, "aria-label": accessibilityLabel }, children);
}
export function Text({ children, numberOfLines, adjustsFontSizeToFit, maxFontSizeMultiplier }: Record<string, any>) {
  return React.createElement("span", { "data-lines": numberOfLines, "data-shrinks": adjustsFontSizeToFit ? "yes" : undefined, "data-font-limit": maxFontSizeMultiplier }, children);
}
export const StyleSheet = {
  create<T>(styles: T): T { return styles; },
  flatten(style: any): any {
    return Array.isArray(style) ? Object.assign({}, ...style.map(StyleSheet.flatten)) : style || {};
  },
};
export const Animated = {
  Value: class { constructor(public value: number) {} setValue(value: number) { this.value = value; } },
  createAnimatedComponent: (component: any) => component,
};
const motionListeners = new Set<(enabled: boolean) => void>();
export function __setReduceMotion(enabled: boolean) { for (const listener of motionListeners) listener(enabled); }
export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  addEventListener: (_event: string, listener: (enabled: boolean) => void) => {
    motionListeners.add(listener);
    return { remove() { motionListeners.delete(listener); } };
  },
};
