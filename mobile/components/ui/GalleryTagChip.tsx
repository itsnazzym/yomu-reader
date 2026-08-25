import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { IconHeart, IconMinus, IconPlus } from "@tabler/icons-react-native";
import type { Tag } from "@/lib/api/types";
import { TagLabel } from "@/components/ui/TagLabel";

export interface GalleryTagChipColors {
  accent: string;
  tagBg: string;
  tagText: string;
  sub: string;
}

export interface GalleryTagChipProps {
  tag: Pick<Tag, "id" | "type" | "name" | "count">;
  colors: GalleryTagChipColors;
  inSearch: boolean;
  isFavorited: boolean;
  onPressSearch: () => void;
  onToggleSearch: () => void;
  onToggleFavorite: () => void;
}

/** Chip interactif de la fiche galerie (+/− recherche, favori). */
export function GalleryTagChip({
  tag,
  colors,
  inSearch,
  isFavorited,
  onPressSearch,
  onToggleSearch,
  onToggleFavorite,
}: GalleryTagChipProps) {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: inSearch ? colors.accent + "22" : colors.tagBg,
          borderColor: inSearch
            ? colors.accent
            : isFavorited
              ? colors.accent
              : "rgba(255,255,255,0.06)",
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPressSearch}
        style={styles.mainPress}
        accessibilityRole="button"
        accessibilityLabel={`Rechercher ${tag.name}`}
      >
        <View style={styles.textWrap}>
          <TagLabel name={tag.name} color={colors.tagText} variant="chip" />
          {typeof tag.count === "number" && tag.count > 0 ? (
            <TagLabel
              name={tag.count > 999 ? `${(tag.count / 1000).toFixed(0)}k` : String(tag.count)}
              color={colors.sub}
              variant="inline"
              style={styles.countLabel}
            />
          ) : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={6}
        onPress={onToggleSearch}
        style={[
          styles.actionBtn,
          {
            borderLeftColor: "rgba(255,255,255,0.1)",
            backgroundColor: inSearch ? colors.accent + "33" : "transparent",
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: inSearch }}
        accessibilityLabel={
          inSearch
            ? `Retirer ${tag.name} de la recherche`
            : `Ajouter ${tag.name} à la recherche`
        }
      >
        {inSearch ? (
          <IconMinus size={13} color={colors.accent} strokeWidth={2.5} />
        ) : (
          <IconPlus size={13} color={colors.accent} strokeWidth={2.5} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={6}
        onPress={onToggleFavorite}
        style={styles.actionBtn}
        accessibilityRole="button"
        accessibilityLabel={
          isFavorited
            ? `Retirer ${tag.name} des favoris tags`
            : `Ajouter ${tag.name} aux favoris tags`
        }
      >
        <IconHeart
          size={13}
          color={isFavorited ? "#f43f5e" : colors.sub}
          fill={isFavorited ? "#f43f5e" : "transparent"}
          strokeWidth={1.8}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
    alignSelf: "flex-start",
  },
  mainPress: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  textWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flexShrink: 1,
  },
  countLabel: {
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 0,
  },
  actionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
});
