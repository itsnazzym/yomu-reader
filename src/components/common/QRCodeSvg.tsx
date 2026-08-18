import React, { useMemo } from "react";
import { generateQRMatrix } from "../../utils/qrcode";

interface QRCodeSvgProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  className?: string;
}

export const QRCodeSvg: React.FC<QRCodeSvgProps> = ({
  value,
  size = 200,
  fgColor = "#ffffff",
  bgColor = "transparent",
  className = "",
}) => {
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(value);
    } catch (e) {
      console.warn("QR code generation error:", e);
      return [];
    }
  }, [value]);

  if (!matrix || matrix.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-[#1e1e28] rounded-xl text-gray-400 text-xs ${className}`}
        style={{ width: size, height: size }}
      >
        QR Indisponible
      </div>
    );
  }

  const moduleCount = matrix.length;
  const padding = 2; // Quiet zone modules
  const totalGrid = moduleCount + padding * 2;

  return (
    <svg
      viewBox={`0 0 ${totalGrid} ${totalGrid}`}
      width={size}
      height={size}
      className={`select-none ${className}`}
      shapeRendering="crispEdges"
    >
      {bgColor !== "transparent" && (
        <rect width={totalGrid} height={totalGrid} fill={bgColor} />
      )}
      {matrix.map((row, r) =>
        row.map((isDark, c) =>
          isDark ? (
            <rect
              key={`${r}-${c}`}
              x={c + padding}
              y={r + padding}
              width={1.02}
              height={1.02}
              fill={fgColor}
            />
          ) : null
        )
      )}
    </svg>
  );
};
