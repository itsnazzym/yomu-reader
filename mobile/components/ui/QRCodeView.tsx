import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { generateQRMatrix } from "../../lib/qrcode";

interface QRCodeViewProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
}

export const QRCodeView: React.FC<QRCodeViewProps> = ({
  value,
  size = 180,
  fgColor = "#ffffff",
  bgColor = "transparent",
}) => {
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(value);
    } catch {
      return [];
    }
  }, [value]);

  if (!matrix || matrix.length === 0) {
    return <View style={[styles.placeholder, { width: size, height: size }]} />;
  }

  const moduleCount = matrix.length;
  const padding = 2;
  const totalGrid = moduleCount + padding * 2;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${totalGrid} ${totalGrid}`}
    >
      {bgColor !== "transparent" && (
        <Rect width={totalGrid} height={totalGrid} fill={bgColor} />
      )}
      {matrix.map((row, r) =>
        row.map((isDark, c) =>
          isDark ? (
            <Rect
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
    </Svg>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "#1e1e28",
    borderRadius: 12,
  },
});
