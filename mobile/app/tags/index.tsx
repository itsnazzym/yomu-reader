import React, { useState, useMemo, useCallback, useEffect, useRef, useDeferredValue } from "react";
import { StyleSheet, View, Text, TextInput, Pressable, Modal, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking } from "react-native";
import Animated from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import { IconArrowLeft, IconSearch, IconX, IconHeart, IconPlus, IconMinus, IconWorld, IconFolder, IconTrash, IconCheck, IconRefresh, IconChevronDown } from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import { TagLabel } from "@/components/ui/TagLabel";
import { useModalMotion } from "@/components/motion/useModalMotion";
import { SourceAuthModal } from "@/components/modals/SourceAuthModal";
import { useSourceAuth } from "@/lib/sources/authStore";
import { useTagFavs } from "@/lib/tagFavoritesStore";
import { useTagCollections, type TagCollection } from "@/lib/tagCollectionsStore";
import { useHomeSearch } from "@/lib/homeSearchStore";
import { queryContainsTerm, normalizeTagType } from "@/lib/searchQuery";
import { useTagCatalog } from "@/lib/useTagCatalog";
import { catalogTagKey, categoryForType, isTagSource, tagSearchTarget, type CatalogTag, type TagSource, type CatalogCategory } from "@/lib/tagCatalog";
import { listSources } from "@/lib/sources/registry";
import { lightTap } from "@/lib/haptics";

const SOURCE_KEY = "@tags_screen_source";
const SOURCES = listSources();
const sourceLabel = (source: TagSource) => source === "all" ? "Toutes les sources" : SOURCES.find(item => item.id === source)?.label || source;
const CATEGORIES: [CatalogCategory | "all", string][] = [["all", "Tous les types"], ["tags", "Tags"], ["artists", "Artistes"], ["parodies", "Séries"], ["characters", "Personnages"], ["groups", "Groupes"], ["languages", "Langues"], ["categories", "Catégories"]];

function TagSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const motion = useModalMotion(visible);
  return <Modal visible={motion.presented} transparent animationType="none" onRequestClose={onClose}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.65)" }, motion.backdropStyle]} />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.sheetBackdrop, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Animated.View style={[styles.sheet, { backgroundColor: colors.page, borderColor: colors.tagBg }, motion.cardStyle]}>
        <View style={[styles.sheetHeader, { borderColor: colors.tagBg }]}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.txt, flex: 1 }]}>{title}</Text>
          <Pressable onPress={onClose} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Fermer le menu"><IconX size={22} color={colors.txt} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}

export default function TagsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const favorites = useTagFavs();
  const packs = useTagCollections();
  const { query: homeQuery, setQuery: setHomeQuery, toggleTerm } = useHomeSearch();
  const { toggleFav, favoriteList } = favorites;
  const ruleAuth = useSourceAuth("rule34");
  const [source, setSource] = useState<TagSource>("all");
  const sourceChosen = useRef(false);
  const [mode, setMode] = useState<"browse" | "favs" | "packs">("browse");
  const [category, setCategory] = useState<CatalogCategory | "all">("all");
  const [search, setSearch] = useState("");
  const filter = useDeferredValue(search.trim().toLowerCase().replace(/_/g, " "));
  const catalog = useTagCatalog(source, ruleAuth.updatedAt || 0);
  const [sourceMenu, setSourceMenu] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [packName, setPackName] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [packColor, setPackColor] = useState("#91a8c1");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(SOURCE_KEY).then(value => { if (active && !sourceChosen.current && isTagSource(value)) setSource(value); }).catch(() => {});
    return () => { active = false; if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, []);
  const chooseSource = (next: TagSource) => {
    lightTap(); sourceChosen.current = true; setSource(next); setCategory("all"); setSourceMenu(false);
    void AsyncStorage.setItem(SOURCE_KEY, next).catch(() => {});
  };
  const inform = useCallback((message: string) => {
    setNotice(message); if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 1600);
  }, []);
  const tagMap = useMemo(() => new Map(catalog.items.map(tag => [tag.key, tag])), [catalog.items]);
  const favoritesByKey = useMemo(() => new Map(favoriteList.map(favorite => [catalogTagKey(favorite.type, favorite.name), favorite])), [favoriteList]);
  const favoriteItems = useMemo(() => [...favoritesByKey.values()].flatMap(favorite => {
    const type = normalizeTagType(favorite.type);
    const key = catalogTagKey(type, favorite.name);
    const match = tagMap.get(key);
    if (match) return [match];
    return source === "all" ? [{ key, name: favorite.name, type, category: categoryForType(type), sources: [], nativeNames: {} } as CatalogTag] : [];
  }), [favoritesByKey, tagMap, source]);
  const rows = useMemo(() => (mode === "favs" ? favoriteItems : catalog.items).filter(tag =>
    (category === "all" || tag.category === category) && (!filter || `${tag.type}:${tag.name}`.toLowerCase().includes(filter))
  ), [mode, favoriteItems, catalog.items, category, filter]);
  const filteredPacks = useMemo(() => packs.collections.filter(pack => !filter || `${pack.name} ${pack.description || ""} ${pack.tags.map(tag => tag.name).join(" ")}`.toLowerCase().includes(filter)), [packs.collections, filter]);
  const availableCategories = useMemo(() => new Set(catalog.items.map(tag => tag.category)), [catalog.items]);
  const openTag = useCallback((tag: CatalogTag) => {
    lightTap(); const target = tagSearchTarget(tag, source); setHomeQuery(target.query);
    router.push({ pathname: "/", params: { query: target.query, src: target.source } });
  }, [source, setHomeQuery, router]);
  const toggleTag = useCallback((tag: CatalogTag) => {
    lightTap(); const result = toggleTerm(tag.type, tag.name);
    inform(`${tag.name} ${result.added ? "ajouté à" : "retiré de"} la recherche`);
  }, [toggleTerm, inform]);
  const toggleFavorite = useCallback((tag: CatalogTag) => {
    lightTap(); void toggleFav(favoritesByKey.get(tag.key) || { type: tag.type, name: tag.name, category: tag.category });
  }, [toggleFav, favoritesByKey]);
  const renderRow = useCallback(({ item }: { item: CatalogTag }) => {
    const inSearch = queryContainsTerm(homeQuery, item.type, item.name);
    const favorited = favoritesByKey.has(item.key);
    const label = CATEGORIES.find(([key]) => key === item.category)?.[1] || "Tag";
    return <View style={[styles.tagRow, { borderColor: colors.tagBg, backgroundColor: colors.page }]}>
      <CardPressable radius={0} onPress={() => openTag(item)} style={styles.tagMain} accessibilityRole="button" accessibilityLabel={`Rechercher ${item.name}`}>
        <TagLabel name={item.name} prefix={!["tag", "artist", "parody", "character", "group", "language", "category"].includes(item.type) ? `${item.type}:` : undefined} variant="chip" style={[styles.tagName, { color: colors.txt }]} />
        <Text style={[styles.rowMeta, { color: colors.sub }]}>{label} · {item.sources.length ? item.sources.map(sourceLabel).join(" / ") : "Favori enregistré"}</Text>
      </CardPressable>
      <Pressable onPress={() => toggleTag(item)} style={styles.iconButton} accessibilityRole="button" accessibilityState={{ selected: inSearch }} accessibilityLabel={`${inSearch ? "Retirer" : "Ajouter"} ${item.name} ${inSearch ? "de" : "à"} la recherche`}>
        {inSearch ? <IconMinus size={20} color={colors.txt} /> : <IconPlus size={20} color={colors.metaText} />}
      </Pressable>
      <Pressable onPress={() => toggleFavorite(item)} style={styles.iconButton} accessibilityRole="button" accessibilityState={{ selected: favorited }} accessibilityLabel={`${favorited ? "Retirer" : "Ajouter"} ${item.name} ${favorited ? "des" : "aux"} favoris`}>
        <IconHeart size={19} color={favorited ? "#e5a5b2" : colors.sub} fill={favorited ? "#e5a5b2" : "transparent"} />
      </Pressable>
    </View>;
  }, [colors, homeQuery, favoritesByKey, openTag, toggleTag, toggleFavorite]);
  const launchPack = (pack: TagCollection) => {
    const query = source === "rule34" ? [...pack.tags.map(tag => tagMap.get(catalogTagKey(tag.type, tag.name))?.nativeNames.rule34 || tag.name.replace(/ /g, "_")), ...(pack.excludeTags || []).map(tag => `-${tag.name.replace(/ /g, "_")}`)].join(" ") : packs.formatQuery(pack);
    setHomeQuery(query); router.push({ pathname: "/", params: { query, src: source } });
  };
  const createPack = async () => {
    if (!packName.trim() || !chosen.length || saving) return;
    setSaving(true); setSaveError(null);
    try {
      await packs.createCollection(packName, favoriteItems.filter(tag => chosen.includes(tag.key)).map(tag => ({ type: tag.type, name: tag.name })), { description: packDescription, color: packColor });
      setCreateOpen(false); setPackName(""); setPackDescription(""); setChosen([]); inform("Pack créé");
    } catch { setSaveError("Impossible d’enregistrer le pack. Réessayez."); } finally { setSaving(false); }
  };

  return <View style={[styles.root, { paddingTop: Math.max(insets.top, 12), backgroundColor: colors.bg }]}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Revenir en arrière"><IconArrowLeft size={22} color={colors.txt} /></Pressable>
      <View style={{ flex: 1, minWidth: 0 }}><Text accessibilityRole="header" style={[styles.title, { color: colors.txt }]}>Tags & packs</Text><Text style={[styles.small, { color: colors.sub }]}>Explorez, composez, retrouvez.</Text></View>
      {mode === "packs" && <CardPressable onPress={() => { setSaveError(null); setCreateOpen(true); }} style={[styles.createButton, { backgroundColor: colors.tagBg }]} accessibilityRole="button"><IconPlus size={18} color={colors.txt} /><ButtonLabel style={{ color: colors.txt, fontWeight: "600" }}>Créer</ButtonLabel></CardPressable>}
    </View>
    <View style={[styles.segmented, { backgroundColor: colors.page }]}>
      {([["browse", "Explorer"], ["favs", "Favoris"], ["packs", "Packs"]] as const).map(([id, label]) => <Pressable key={id} onPress={() => { lightTap(); setMode(id); setCategory("all"); setSearch(""); }} accessibilityRole="tab" accessibilityState={{ selected: mode === id }} style={[styles.segment, mode === id && { backgroundColor: colors.tagBg }]}><ButtonLabel style={{ color: mode === id ? colors.txt : colors.sub, fontWeight: "600", fontSize: 14 }}>{label}</ButtonLabel></Pressable>)}
    </View>
    <View style={styles.sourceRow}>
      <Pressable onPress={() => setSourceMenu(true)} style={[styles.sourceButton, { borderColor: colors.tagBg, backgroundColor: colors.page }]} accessibilityRole="button" accessibilityLabel={`Choisir la source : ${sourceLabel(source)}`}>
        <IconWorld size={18} color={colors.sub} /><Text style={[styles.sourceName, { color: colors.txt }]}>{sourceLabel(source)}</Text><IconChevronDown size={18} color={colors.sub} />
      </Pressable>
      <Pressable onPress={catalog.refresh} disabled={catalog.loading} accessibilityRole="button" accessibilityLabel="Actualiser les tags" style={styles.iconButton}>
        {catalog.loading ? <ActivityIndicator color={colors.metaText} /> : <IconRefresh size={20} color={colors.metaText} />}
      </Pressable>
    </View>
    <View style={[styles.searchBox, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
      <IconSearch size={19} color={colors.sub} />
      <TextInput accessibilityLabel={mode === "packs" ? "Rechercher un pack" : "Rechercher un tag"} value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} placeholder={mode === "packs" ? "Rechercher un pack" : "Rechercher un tag, un artiste…"} placeholderTextColor={colors.sub} style={[styles.input, { color: colors.txt }]} />
      {!!search && <Pressable onPress={() => setSearch("")} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Effacer le filtre"><IconX size={18} color={colors.sub} /></Pressable>}
    </View>
    {mode !== "packs" && <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
      {CATEGORIES.filter(([key]) => key === "all" || availableCategories.has(key)).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: category === key }} onPress={() => setCategory(key)} style={[styles.category, { borderColor: category === key ? colors.sub : "transparent", backgroundColor: category === key ? colors.page : "transparent" }]}><ButtonLabel style={{ color: category === key ? colors.txt : colors.sub, fontSize: 13 }}>{label}</ButtonLabel></Pressable>)}
    </ScrollView></View>}
    <View style={styles.resultHeader}>
      <Text accessibilityLiveRegion="polite" style={[styles.small, { color: colors.sub }]}>{(mode === "packs" ? filteredPacks.length : rows.length).toLocaleString("fr-FR")} {mode === "packs" ? "packs" : source === "all" ? "tags uniques" : "tags"}{catalog.loading && mode !== "packs" ? " · chargement…" : ""}</Text>
      {!!catalog.errors.length && mode !== "packs" && <Pressable onPress={() => setSourceMenu(true)} accessibilityRole="button" style={styles.statusButton}><ButtonLabel style={{ color: "#e4b8aa", fontSize: 12 }}>{catalog.errors.length} source{catalog.errors.length > 1 ? "s" : ""} à vérifier</ButtonLabel></Pressable>}
    </View>
    {!!notice && <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: colors.txt, backgroundColor: colors.tagBg }]}>{notice}</Text>}
    {catalog.hasMore && mode !== "packs" && <Pressable onPress={catalog.loadMore} disabled={catalog.loading} style={[styles.moreButton, { backgroundColor: colors.page }]} accessibilityRole="button"><ButtonLabel style={{ color: colors.metaText }}>Charger la suite du répertoire Rule34</ButtonLabel></Pressable>}
    {source === "rule34" && !!catalog.states.rule34?.error && <CardPressable onPress={() => { if (!ruleAuth.isLoggedIn) { setAuthOpen(true); } else { catalog.retry("rule34"); } }} style={[styles.moreButton, { backgroundColor: colors.tagBg }]} accessibilityRole="button"><ButtonLabel style={{ color: colors.txt }}>{!ruleAuth.isLoggedIn ? "Configurer la connexion Rule34" : "Réessayer Rule34"}</ButtonLabel></CardPressable>}
    {mode === "packs" ? <FlashList data={filteredPacks} keyExtractor={pack => pack.id} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} ListEmptyComponent={<View style={styles.empty}><IconFolder size={32} color={colors.sub} /><Text style={[styles.sectionTitle, { color: colors.txt }]}>Vos recherches, en un pack</Text><Text style={[styles.body, { color: colors.sub }]}>Regroupez vos tags favoris pour lancer une recherche en un geste.</Text></View>} renderItem={({ item: pack }) => <View style={[styles.pack, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
      <View style={styles.packHeader}><View style={[styles.colorDot, { backgroundColor: pack.color }]} /><Text style={[styles.packName, { color: colors.txt }]}>{pack.name}</Text><Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Supprimer le pack ${pack.name}`} onPress={() => Alert.alert("Supprimer le pack ?", pack.name, [{ text: "Annuler", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: () => { void packs.deleteCollection(pack.id).catch(() => inform("Suppression impossible. Réessayez.")); } }])}><IconTrash size={18} color={colors.sub} /></Pressable></View>
      {!!pack.description && <Text style={[styles.body, { color: colors.sub }]}>{pack.description}</Text>}
      <View style={styles.packTags}>{pack.tags.map(tag => <TagLabel key={`${tag.type}:${tag.name}`} name={tag.name} prefix="+ " variant="inline" color={colors.metaText} />)}{pack.excludeTags?.map(tag => <TagLabel key={`exclude:${tag.type}:${tag.name}`} name={tag.name} prefix="− " variant="inline" color="#e4b8aa" />)}</View>
      <CardPressable onPress={() => launchPack(pack)} accessibilityRole="button" style={[styles.moreButton, { backgroundColor: colors.tagBg, marginHorizontal: 0 }]}><IconSearch size={17} color={colors.txt} /><ButtonLabel style={{ color: colors.txt }}>Rechercher ce pack</ButtonLabel></CardPressable>
    </View>} /> : <FlashList key={`${mode}:${source}`} extraData={favoriteList} data={rows} renderItem={renderRow} keyExtractor={tag => tag.key} drawDistance={350} onEndReached={catalog.hasMore && !filter ? catalog.loadMore : undefined} onEndReachedThreshold={0.2} refreshing={catalog.loading} onRefresh={catalog.refresh} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }} ListEmptyComponent={<View style={styles.empty}>
      {catalog.loading ? <ActivityIndicator color={colors.metaText} /> : <IconSearch size={30} color={colors.sub} />}
      <Text style={[styles.sectionTitle, { color: colors.txt }]}>{catalog.loading ? "Chargement du répertoire" : mode === "favs" ? "Aucun favori pour ce filtre" : catalog.errors.length ? "Ce répertoire est indisponible" : "Aucun tag trouvé"}</Text>
      <Text style={[styles.body, { color: colors.sub }]}>{mode === "favs" ? "Utilisez le cœur à côté d’un tag pour le retrouver ici." : catalog.errors.length ? "Ouvrez le menu des sources pour réessayer. Les tags des autres sites restent séparés." : "Essayez un autre nom ou une autre catégorie."}</Text>
    </View>} />}
    {(source === "ehentai" || source === "all") && mode !== "packs" && <Pressable onPress={() => { void Linking.openURL("https://github.com/EhTagTranslation/Database"); }} style={styles.attribution} accessibilityRole="link"><Text style={[styles.small, { color: colors.sub }]}>Répertoire : EhTagTranslation · CC BY-NC-SA 3.0</Text></Pressable>}

    <TagSheet visible={sourceMenu} title="Sources des tags" onClose={() => setSourceMenu(false)}>
      <Text style={[styles.body, { color: colors.sub }]}>« Tout » réunit les répertoires chargés sans doublons. Le type de chaque tag reste visible.</Text>
      {(["all", ...SOURCES.map(meta => meta.id)] as TagSource[]).map(id => <View key={id}>
        <Pressable onPress={() => chooseSource(id)} style={[styles.sourceOption, { borderColor: colors.tagBg }]} accessibilityRole="radio" accessibilityState={{ selected: source === id }} accessibilityLabel={`Afficher les tags ${sourceLabel(id)}`}>
          <View style={{ flex: 1, gap: 4 }}><Text style={[styles.sourceName, { color: colors.txt }]}>{id === "all" ? "Tout" : sourceLabel(id)}</Text><Text style={[styles.small, { color: colors.sub }]}>{id === "all" ? "Union des sources, tags dédupliqués" : catalog.states[id]?.loading ? "Chargement…" : catalog.states[id]?.error ? catalog.states[id]?.error : !catalog.states[id]?.loaded ? "Pas encore chargé" : `${(catalog.states[id]?.tags.length || 0).toLocaleString("fr-FR")} tags${catalog.states[id]?.hasMore ? " · suite disponible" : ""}`}</Text></View>
          {source === id && <IconCheck size={20} color={colors.txt} />}
        </Pressable>
        {id !== "all" && catalog.states[id]?.error && <Pressable onPress={() => { if (id === "rule34" && !ruleAuth.isLoggedIn) { setSourceMenu(false); setAuthOpen(true); } else catalog.retry(id); }} accessibilityRole="button" style={styles.moreButton}><ButtonLabel style={{ color: colors.metaText }}>{id === "rule34" && !ruleAuth.isLoggedIn ? "Configurer Rule34" : `Réessayer ${sourceLabel(id)}`}</ButtonLabel></Pressable>}
      </View>)}
    </TagSheet>
    <TagSheet visible={createOpen} title="Nouveau pack" onClose={() => { if (!saving) setCreateOpen(false); }}>
      <Text style={[styles.label, { color: colors.txt }]}>Nom du pack</Text><TextInput accessibilityLabel="Nom du pack" value={packName} onChangeText={setPackName} editable={!saving} placeholder="Ex. Mes lectures du week-end" placeholderTextColor={colors.sub} style={[styles.formInput, { color: colors.txt, borderColor: colors.tagBg, backgroundColor: colors.bg }]} />
      <Text style={[styles.label, { color: colors.txt }]}>Description (facultative)</Text><TextInput accessibilityLabel="Description du pack" value={packDescription} onChangeText={setPackDescription} editable={!saving} multiline placeholder="Ce que ce pack réunit" placeholderTextColor={colors.sub} style={[styles.formInput, { color: colors.txt, borderColor: colors.tagBg, backgroundColor: colors.bg }]} />
      <Text style={[styles.label, { color: colors.txt }]}>Couleur</Text><View style={styles.palette}>{["#91a8c1", "#b2a1c7", "#92b6a3", "#c3ab89", "#c6969f"].map((color, index) => <Pressable key={color} disabled={saving} onPress={() => setPackColor(color)} accessibilityRole="radio" accessibilityLabel={`Couleur ${index + 1}`} accessibilityState={{ selected: packColor === color }} style={[styles.swatch, { backgroundColor: color }]}>{packColor === color && <IconCheck size={20} color="#18202a" />}</Pressable>)}</View>
      <Text style={[styles.label, { color: colors.txt }]}>Tags favoris · {chosen.length} sélectionné{chosen.length > 1 ? "s" : ""}</Text>
      {!favoriteItems.length && <Text style={[styles.body, { color: colors.sub }]}>Ajoutez d’abord des tags à vos favoris dans Explorer. Vous pourrez ensuite les réunir ici.</Text>}
      <View style={styles.packTags}>{favoriteItems.map(tag => <Pressable key={tag.key} disabled={saving} onPress={() => setChosen(previous => previous.includes(tag.key) ? previous.filter(key => key !== tag.key) : [...previous, tag.key])} accessibilityRole="checkbox" accessibilityState={{ checked: chosen.includes(tag.key) }} style={[styles.selectionChip, { borderColor: chosen.includes(tag.key) ? colors.sub : colors.tagBg, backgroundColor: chosen.includes(tag.key) ? colors.tagBg : colors.bg }]}><TagLabel name={tag.name} variant="chip" color={colors.txt} /></Pressable>)}</View>
      {!!saveError && <Text accessibilityRole="alert" style={{ color: "#e4b8aa" }}>{saveError}</Text>}
      <CardPressable disabled={!packName.trim() || !chosen.length || saving} accessibilityRole="button" accessibilityState={{ disabled: !packName.trim() || !chosen.length || saving, busy: saving }} onPress={createPack} style={[styles.moreButton, { backgroundColor: colors.tagBg, marginHorizontal: 0 }]}>{saving && <ActivityIndicator color={colors.txt} />}<ButtonLabel style={{ color: colors.txt, fontWeight: "600" }}>{saving ? "Enregistrement…" : "Créer le pack"}</ButtonLabel></CardPressable>
    </TagSheet>
    <SourceAuthModal visible={authOpen} initialSource="rule34" onClose={() => { setAuthOpen(false); catalog.retry("rule34"); }} onSuccess={() => { catalog.retry("rule34"); }} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingBottom: 12 }, title: { fontSize: 23, fontWeight: "700" }, small: { fontSize: 12, lineHeight: 18 }, body: { fontSize: 14, lineHeight: 21 }, sectionTitle: { fontSize: 18, fontWeight: "600" },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }, segmented: { flexDirection: "row", marginHorizontal: 16, borderRadius: 14, padding: 4, gap: 4 }, segment: { flex: 1, minWidth: 0, minHeight: 48, padding: 8, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  sourceRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, gap: 8 }, sourceButton: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48 }, sourceName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "600" },
  searchBox: { marginHorizontal: 16, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingLeft: 12 }, input: { flex: 1, minWidth: 0, minHeight: 52, paddingVertical: 12, fontSize: 15 },
  categoryList: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 }, category: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" }, resultHeader: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, statusButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 8 }, notice: { marginHorizontal: 16, padding: 12, borderRadius: 10, marginBottom: 8, fontSize: 13 },
  tagRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingRight: 4 }, tagMain: { flex: 1, minWidth: 0, paddingVertical: 15, paddingHorizontal: 12, gap: 5 }, tagName: { fontSize: 15, lineHeight: 22, fontWeight: "500" }, rowMeta: { fontSize: 11, lineHeight: 17 },
  empty: { padding: 24, gap: 14, alignItems: "flex-start" }, moreButton: { minHeight: 48, marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, attribution: { paddingHorizontal: 16, paddingVertical: 8 },
  createButton: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, gap: 8, flexDirection: "row", alignItems: "center" }, pack: { padding: 16, borderWidth: 1, borderRadius: 14, gap: 12, marginBottom: 12 }, packHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, packName: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "600" }, colorDot: { width: 10, height: 10, borderRadius: 5 }, packTags: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sheetBackdrop: { flex: 1, paddingHorizontal: 12, justifyContent: "center", alignItems: "center" }, sheet: { width: "100%", maxWidth: 520, height: "86%", borderRadius: 22, borderWidth: 1, overflow: "hidden" }, sheetHeader: { flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 8, paddingVertical: 8, borderBottomWidth: 1 }, sheetContent: { padding: 20, paddingBottom: 32, gap: 12 }, sourceOption: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 12, borderBottomWidth: 1 }, label: { fontSize: 14, fontWeight: "600", marginTop: 4 }, formInput: { minHeight: 52, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 }, palette: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, swatch: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }, selectionChip: { minHeight: 48, justifyContent: "center", borderRadius: 10, borderWidth: 1, padding: 12, maxWidth: "100%" },
});
