import React from "react";

interface IconProps {
  name: string;
  size?: number | string;
  className?: string;
  filled?: boolean;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 18,
  className = "",
  filled = false,
}) => {
  const style: React.CSSProperties = typeof size === "number" ? { fontSize: `${size}px` } : {};

  return (
    <span
      className={`material-symbols-outlined select-none inline-flex items-center justify-center leading-none ${
        filled ? "material-symbols-fill" : ""
      } ${className}`}
      style={style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
};
