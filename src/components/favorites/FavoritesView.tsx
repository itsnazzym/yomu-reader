import React, { useState } from "react";
import { Gallery } from "../../types";
import { useFavoriteStore } from "../../stores/favoriteStore";
import { GalleryCard } from "../gallery/GalleryCard";
import { Icon } from "../common/Icon";

interface FavoritesViewProps {
  onSelectGallery: (gallery: Gallery) => void;
  onReadGallery?: (gallery: Gallery, initialPage?: number) => void;
  onQuickDownload?: (gallery: Gallery) => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  onSelectGallery,
  onReadGallery,
  onQuickDownload,
}) => {
  const { favorites, clearFavorites, exportFavoritesJson, importFavoritesJson } = useFavoriteStore();
  const [filterQuery, setFilterQuery] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const filteredFavorites = favorites.filter((f) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    const title = (f.gallery.title?.pretty || f.gallery.title?.english || "").toLowerCase();
    const artist = (f.gallery.tags?.find((t) => t.type === "artist")?.name || "").toLowerCase();
    return title.includes(q) || artist.includes(q) || String(f.id).includes(q);
  });

  const handleExport = () => {
    const json = exportFavoritesJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yomu_favorites_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = importFavoritesJson(content);
        if (ok) {
          setImportStatus("Favoris importés avec succès !");
        } else {
          setImportStatus("Erreur : format JSON invalide.");
        }
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#252532]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ed2553]/15 border border-[#ed2553]/30 flex items-center justify-center text-[#ed2553]">
            <Icon name="favorite" size={24} filled />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Mes Favoris Hors-Ligne</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#2a2a38] text-rose-300 font-mono">
                {favorites.length}
              </span>
            </h1>
            <p className="text-xs text-gray-400">Mangas enregistrés localement sur votre ordinateur</p>
          </div>
        </div>

        {/* Actions: Search, Export, Import, Clear */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrer mes favoris..."
              className="bg-[#20202c] text-white placeholder-gray-500 px-3.5 py-1.5 pl-8 rounded-lg text-xs outline-none border border-[#323244] focus:border-[#ed2553] w-48 transition-colors"
            />
            <Icon name="search" size={14} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={handleExport}
            disabled={favorites.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20202c] hover:bg-[#2b2b3a] text-gray-200 text-xs font-semibold border border-[#323244] transition-colors disabled:opacity-40 cursor-pointer"
            title="Exporter la collection en JSON"
          >
            <Icon name="file_download" size={16} className="text-rose-400" />
            <span>Exporter</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20202c] hover:bg-[#2b2b3a] text-gray-200 text-xs font-semibold border border-[#323244] transition-colors cursor-pointer">
            <Icon name="file_upload" size={16} className="text-emerald-400" />
            <span>Importer</span>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>

          {favorites.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Êtes-vous sûr de vouloir vider tous vos favoris ?")) {
                  clearFavorites();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold border border-rose-800/40 transition-colors cursor-pointer"
              title="Vider la liste des favoris"
            >
              <Icon name="delete_sweep" size={16} />
              <span>Vider</span>
            </button>
          )}
        </div>
      </div>

      {/* Import Status Alert */}
      {importStatus && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <Icon name="info" size={16} />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Grid of Favorite Mangas */}
      {favorites.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-[#20202c] border border-[#303040] mx-auto flex items-center justify-center text-gray-500">
            <Icon name="favorite_border" size={32} />
          </div>
          <h3 className="text-sm font-bold text-gray-300">Aucun favori enregistré</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Cliquez sur l'icône cœur en haut à droite des cartes ou dans la fiche d'un manga pour l'ajouter à vos favoris hors-ligne.
          </p>
        </div>
      ) : filteredFavorites.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-xs">
          Aucun manga ne correspond à votre recherche "{filterQuery}".
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredFavorites.map((fav) => (
            <div key={fav.id} className="relative">
              {fav.sourceUnavailable && (
                <div className="absolute inset-x-1 top-1 z-10 rounded-md bg-amber-950/90 border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-200 font-semibold text-center">
                  Source mobile seule ({fav.id.split(":")[0]})
                </div>
              )}
              <GalleryCard
                gallery={fav.gallery}
                onSelect={(g) => {
                  if (fav.sourceUnavailable) {
                    window.alert(
                      `Cette galerie (${fav.id}) vient d’une source non disponible sur le desktop. Ouvre-la sur Yomu mobile.`
                    );
                    return;
                  }
                  onSelectGallery(g);
                }}
                onRead={
                  fav.sourceUnavailable
                    ? undefined
                    : onReadGallery
                }
                onQuickDownload={
                  fav.sourceUnavailable ? undefined : onQuickDownload
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
