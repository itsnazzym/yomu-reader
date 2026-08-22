import React, { memo } from "react";
import { StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";
import SmartImage from "@/components/SmartImage";

export interface ReaderPageProps {
  uri: string;
  width: number;
  height: number;
  contentFit: "cover" | "contain";
}

function ReaderPageInner({ uri, width, height, contentFit }: ReaderPageProps) {
  const imageStyle: StyleProp<ImageStyle> = { width, height };

  return (
    <View style={styles.fill}>
      <SmartImage
        uri={uri}
        style={imageStyle}
        contentFit={contentFit}
        showLoader={false}
        recyclingKey={uri}
      />
    </View>
  );
}

export const ReaderPage = memo(ReaderPageInner);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
