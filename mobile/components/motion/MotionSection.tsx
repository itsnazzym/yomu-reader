import React from "react";
import { MotiView } from "moti";
import { useReduceMotion } from "@/lib/reduceMotion";

/** Key the section at its call site, inside AnimatePresence, for tab continuity. */
export function MotionSection({ children }: { children: React.ReactNode }) {
  const reduced = useReduceMotion();
  return <MotiView
    from={{ opacity: 0, translateX: reduced ? 0 : 48 }}
    animate={{ opacity: 1, translateX: 0 }}
    exit={{ opacity: 0, translateX: reduced ? 0 : -24 }}
    transition={{ type: "timing", duration: reduced ? 80 : 260 }}
    exitTransition={{ type: "timing", duration: reduced ? 60 : 110 }}
    style={{ gap: 16, minWidth: 0 }}
  >{children}</MotiView>;
}
