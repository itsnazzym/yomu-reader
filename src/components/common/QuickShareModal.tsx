import React, { useState, useEffect } from "react";
import { Gallery } from "../../types";
import { getGalleryDisplayTitle, getCoverUrl, getGalleryLanguage, buildImageFallbacks } from "../../utils/ipc";
import { Icon } from "./Icon";
import { QRCodeSvg } from "./QRCodeSvg";
import { SmartImage } from "./SmartImage";

interface QuickShareModalProps {
  gallery: Gallery | null;
  onClose: () => void;
}

export const QuickShareModal: React.FC<QuickShareModalProps> = ({ gallery, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"qr" | "links" | "native">("qr");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!gallery) return null;

  const title = getGalleryDisplayTitle(gallery);
  const lang = getGalleryLanguage(gallery);
  const shareUrl = `https://nhentai.net/g/${gallery.id}/`;
  const deepLinkUrl = `nh://gallery/${gallery.id}`;
  const markdownLink = `[${title}](${shareUrl})`;
  const bbcodeLink = `[url=${shareUrl}]${title}[/url]`;
  const idTag = `#d${gallery.id}`;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Découvre "${title}" sur nHentai (#${gallery.id})`,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("Native share error:", err);
        }
      }
    }
    // Fallback: copy link
    copyToClipboard(shareUrl, "native");
  };

  const openInBrowser = () => {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const coverUrl = getCoverUrl(gallery);
  const mid = gallery.media_id || String(gallery.id);
  const coverCandidates = buildImageFallbacks(coverUrl, "thumb", mid);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#161622] border border-[#2b2b3d] rounded-2xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#252535] bg-[#1a1a28]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ed2553] to-[#f43f5e] flex items-center justify-center text-white shadow-lg shadow-[#ed2553]/25">
              <Icon name="share" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Quick Share & AirDrop</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Instant
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Partagez avec votre smartphone, AirDrop ou copiez le lien
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#222232] hover:bg-[#2e2e42] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Fermer (Échap)"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Gallery Summary Banner */}
        <div className="p-4 mx-6 mt-4 rounded-xl bg-[#1d1d2b] border border-[#2c2c40] flex items-center gap-3">
          <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 bg-[#252535] border border-[#35354d]">
            <SmartImage
              candidates={coverCandidates}
              alt={title}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white truncate">{title}</h4>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
              <span className="font-mono text-[#ed2553] font-bold">#d{gallery.id}</span>
              <span>•</span>
              <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-[#2b2b3d] text-gray-300">
                {lang}
              </span>
              <span>•</span>
              <span>{gallery.num_pages} pages</span>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-[#252535]">
          <button
            onClick={() => setActiveTab("qr")}
            className={`flex items-center gap-2 pb-3 px-1 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "qr"
                ? "border-[#ed2553] text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon name="qr_code_2" size={16} />
            <span>AirDrop QR Code</span>
          </button>

          <button
            onClick={() => setActiveTab("links")}
            className={`flex items-center gap-2 pb-3 px-1 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "links"
                ? "border-[#ed2553] text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon name="link" size={16} />
            <span>Copie Multi-Formats</span>
          </button>

          <button
            onClick={() => setActiveTab("native")}
            className={`flex items-center gap-2 pb-3 px-1 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "native"
                ? "border-[#ed2553] text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon name="devices" size={16} />
            <span>Partage Système OS</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-4">
          {activeTab === "qr" && (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-150">
              <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-[#2c2c40] relative group">
                <QRCodeSvg value={shareUrl} size={180} fgColor="#0c0c12" bgColor="#ffffff" />
                <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                  <button
                    onClick={() => copyToClipboard(shareUrl, "qr-overlay")}
                    className="px-4 py-2 rounded-xl bg-[#ed2553] text-white text-xs font-bold shadow-lg cursor-pointer flex items-center gap-1.5"
                  >
                    <Icon name="content_copy" size={16} />
                    <span>Copier le Lien</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1 max-w-sm">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-200">
                  <Icon name="photo_camera" size={16} className="text-emerald-400" />
                  <span>Scan Immédiat Téléphone (iOS & Android)</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Pointez l’appareil photo de votre smartphone vers l’écran pour ouvrir instantanément ce manga.
                </p>
              </div>

              <div className="w-full flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => copyToClipboard(shareUrl, "qr-link")}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#222232] hover:bg-[#2d2d42] border border-[#2f2f45] text-gray-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Icon
                    name={copiedKey === "qr-link" ? "check" : "content_copy"}
                    size={16}
                    className={copiedKey === "qr-link" ? "text-emerald-400" : "text-gray-400"}
                  />
                  <span>{copiedKey === "qr-link" ? "Lien Copié !" : "Copier l'URL"}</span>
                </button>

                <button
                  onClick={openInBrowser}
                  className="py-2 px-4 rounded-xl bg-[#222232] hover:bg-[#2d2d42] border border-[#2f2f45] text-gray-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  title="Ouvrir dans le navigateur"
                >
                  <Icon name="open_in_new" size={16} />
                  <span>Navigateur</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "links" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* Clean Web URL */}
              <div className="p-3 rounded-xl bg-[#1d1d2b] border border-[#2c2c40] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Lien Web Direct
                  </div>
                  <div className="text-xs font-mono text-gray-200 truncate mt-0.5">{shareUrl}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(shareUrl, "web")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    copiedKey === "web"
                      ? "bg-emerald-500 text-white"
                      : "bg-[#28283a] hover:bg-[#34344c] text-gray-200"
                  }`}
                >
                  <Icon name={copiedKey === "web" ? "check" : "content_copy"} size={15} />
                  <span>{copiedKey === "web" ? "Copié !" : "Copier"}</span>
                </button>
              </div>

              {/* Discord & Markdown */}
              <div className="p-3 rounded-xl bg-[#1d1d2b] border border-[#2c2c40] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                    <span>Discord & Markdown</span>
                    <span className="text-[#5865F2] font-mono">[Titre](url)</span>
                  </div>
                  <div className="text-xs font-mono text-gray-200 truncate mt-0.5">{markdownLink}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(markdownLink, "md")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    copiedKey === "md"
                      ? "bg-emerald-500 text-white"
                      : "bg-[#28283a] hover:bg-[#34344c] text-gray-200"
                  }`}
                >
                  <Icon name={copiedKey === "md" ? "check" : "content_copy"} size={15} />
                  <span>{copiedKey === "md" ? "Copié !" : "Copier"}</span>
                </button>
              </div>

              {/* Code ID */}
              <div className="p-3 rounded-xl bg-[#1d1d2b] border border-[#2c2c40] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Code Manga ID
                  </div>
                  <div className="text-xs font-mono font-bold text-[#ed2553] mt-0.5">{idTag}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(String(gallery.id), "id")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    copiedKey === "id"
                      ? "bg-emerald-500 text-white"
                      : "bg-[#28283a] hover:bg-[#34344c] text-gray-200"
                  }`}
                >
                  <Icon name={copiedKey === "id" ? "check" : "content_copy"} size={15} />
                  <span>{copiedKey === "id" ? "Copié !" : "Copier"}</span>
                </button>
              </div>

              {/* BBCode */}
              <div className="p-3 rounded-xl bg-[#1d1d2b] border border-[#2c2c40] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    BBCode Forums
                  </div>
                  <div className="text-xs font-mono text-gray-200 truncate mt-0.5">{bbcodeLink}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(bbcodeLink, "bb")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    copiedKey === "bb"
                      ? "bg-emerald-500 text-white"
                      : "bg-[#28283a] hover:bg-[#34344c] text-gray-200"
                  }`}
                >
                  <Icon name={copiedKey === "bb" ? "check" : "content_copy"} size={15} />
                  <span>{copiedKey === "bb" ? "Copié !" : "Copier"}</span>
                </button>
              </div>

              {/* Deep Link */}
              <div className="p-3 rounded-xl bg-[#1d1d2b] border border-[#2c2c40] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Deep Link App
                  </div>
                  <div className="text-xs font-mono text-cyan-300 truncate mt-0.5">{deepLinkUrl}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(deepLinkUrl, "deep")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    copiedKey === "deep"
                      ? "bg-emerald-500 text-white"
                      : "bg-[#28283a] hover:bg-[#34344c] text-gray-200"
                  }`}
                >
                  <Icon name={copiedKey === "deep" ? "check" : "content_copy"} size={15} />
                  <span>{copiedKey === "deep" ? "Copié !" : "Copier"}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "native" && (
            <div className="space-y-4 text-center py-2 animate-in fade-in duration-150">
              <div className="p-6 rounded-2xl bg-[#1d1d2b] border border-[#2c2c40] space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#ed2553]/15 border border-[#ed2553]/30 text-[#ed2553] flex items-center justify-center mx-auto shadow-inner">
                  <Icon name="airplay" size={28} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Partage Système Direct</h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Déclenchez le menu de partage natif de votre système d’exploitation (AirDrop sur macOS/iOS, Quick Share sur Android, Partage Windows).
                  </p>
                </div>

                <button
                  onClick={handleNativeShare}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ed2553] to-[#f43f5e] hover:from-[#f43f5e] hover:to-[#fb7185] text-white text-xs font-bold shadow-lg shadow-[#ed2553]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Icon name="share" size={18} />
                  <span>Ouvrir le Menu de Partage Système</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#252535] bg-[#14141e] flex items-center justify-between text-[11px] text-gray-500">
          <span>Touche Échap pour fermer</span>
          <span className="text-[#ed2553] font-medium">nHentai Quick Share v2</span>
        </div>
      </div>
    </div>
  );
};
