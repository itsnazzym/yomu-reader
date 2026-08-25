import type { TextStyle } from "react-native";

/** Variantes d'affichage pour les noms de tags dans toute l'app. */
export type TagLabelVariant = "compact" | "chip" | "list" | "inline" | "row";

export interface TagLabelPreset {
  base: TextStyle;
  numberOfLines?: number;
}

/** Styles partagés — évite le rognage Android (flexShrink + minWidth + pas de includeFontPadding). */
export const TAG_LABEL_VARIANTS: Record<TagLabelVariant, TagLabelPreset> = {
  /** BookCard, scroll horizontal étroit */
  compact: {
    base: {
      fontSize: 9.5,
      fontWeight: "600",
      flexShrink: 1,
      minWidth: 0,
      lineHeight: 13,
    },
    numberOfLines: 1,
  },
  /** Chips de fiche galerie, modales, collections */
  chip: {
    base: {
      fontSize: 12,
      fontWeight: "600",
      flexShrink: 1,
      minWidth: 0,
      lineHeight: 16,
    },
  },
  /** Liste explorateur de tags */
  list: {
    base: {
      fontSize: 13,
      fontWeight: "700",
      flexShrink: 1,
      minWidth: 0,
      lineHeight: 18,
    },
    numberOfLines: 2,
  },
  /** Badges compacts (+tag, blacklist, sélection) */
  inline: {
    base: {
      fontSize: 11,
      fontWeight: "600",
      flexShrink: 1,
      minWidth: 0,
      lineHeight: 15,
    },
  },
  /** Lignes recommandations (terme + score à droite) */
  row: {
    base: {
      fontSize: 12.5,
      fontWeight: "600",
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      lineHeight: 17,
      paddingRight: 8,
    },
    numberOfLines: 2,
  },
};

export const TAG_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  artist: { bg: "rgba(236, 72, 153, 0.12)", text: "#f472b6", border: "rgba(236, 72, 153, 0.28)" },
  group: { bg: "rgba(168, 85, 247, 0.12)", text: "#c084fc", border: "rgba(168, 85, 247, 0.28)" },
  parody: { bg: "rgba(124, 58, 237, 0.12)", text: "#a78bfa", border: "rgba(124, 58, 237, 0.28)" },
  character: { bg: "rgba(6, 182, 212, 0.12)", text: "#22d3ee", border: "rgba(6, 182, 212, 0.28)" },
  tag: { bg: "rgba(59, 130, 246, 0.10)", text: "#93c5fd", border: "rgba(59, 130, 246, 0.22)" },
  language: { bg: "rgba(245, 158, 11, 0.12)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.28)" },
};

/** Tous les emplacements connus où un nom de tag est rendu (pour l'audit). */
export const TAG_DISPLAY_SITES = [
  { file: "app/book/[id]/index.tsx", component: "GalleryTagChip", variant: "chip" },
  { file: "components/BookCard/index.tsx", component: "TagLabel", variant: "compact" },
  { file: "app/tags/index.tsx", component: "TagLabel", variant: "list" },
  { file: "app/tags/index.tsx", component: "TagLabel", variant: "inline", note: "colTagBadge, selectTagChip" },
  { file: "app/index.tsx", component: "TagLabel", variant: "list", note: "autocomplete" },
  { file: "app/recommendations.tsx", component: "TagLabel", variant: "compact|row" },
  { file: "components/modals/CollectionPickerModal.tsx", component: "TagLabel", variant: "inline" },
  { file: "app/settings/index.tsx", component: "TagLabel", variant: "inline", note: "blacklist" },
] as const;
