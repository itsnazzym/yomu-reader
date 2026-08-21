import React, { useState, useEffect } from "react";
import { openAuthWindow, onCookiesCaptured } from "../../utils/ipc";
import { Icon } from "./Icon";

interface CloudflareGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CloudflareGateModal: React.FC<CloudflareGateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isSolving, setIsSolving] = useState(false);
  const [solvedSuccess, setSolvedSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSolving(false);
      setSolvedSuccess(false);
      return;
    }

    const unsubscribe = onCookiesCaptured(() => {
      setSolvedSuccess(true);
      setIsSolving(false);
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, onSuccess, onClose]);

  if (!isOpen) return null;

  const handleStartAuth = () => {
    setIsSolving(true);
    openAuthWindow().catch((err) => {
      console.error("Failed to open auth window:", err);
      setIsSolving(false);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#181824] border border-[#333348] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-gray-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <Icon name="close" size={20} />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#ed2553]/15 border border-[#ed2553]/30 flex items-center justify-center text-[#ed2553]">
            <Icon name="shield" size={26} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Validation Cloudflare</h3>
            <p className="text-xs text-gray-400">Contournement et rafraîchissement de session</p>
          </div>
        </div>

        {/* Status Box */}
        {solvedSuccess ? (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-3">
            <Icon name="check_circle" size={22} className="text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-white">Challenge résolu avec succès !</div>
              <div className="text-[11px] text-emerald-300/80">Cookies de session Cloudflare synchronisés.</div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-[#202030] border border-[#2d2d42] text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <Icon name="info" size={16} />
              <span>Pourquoi cette étape ?</span>
            </div>
            <p className="text-gray-300 text-[11px] leading-relaxed">
              nHentai utilise Cloudflare Turnstile pour bloquer les robots. Cliquez sur le bouton ci-dessous pour ouvrir la mini-fenêtre sécurisée et valider la vérification.
            </p>
          </div>
        )}

        {/* Action Button */}
        {!solvedSuccess && (
          <div className="space-y-2">
            <button
              onClick={handleStartAuth}
              disabled={isSolving}
              className="w-full py-3 px-4 rounded-xl bg-[#ed2553] hover:bg-[#f43f5e] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#ed2553]/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSolving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>En attente de résolution du challenge...</span>
                </>
              ) : (
                <>
                  <Icon name="lock_open" size={18} />
                  <span>Ouvrir la validation Cloudflare</span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-gray-500">
              La fenêtre se fermera automatiquement dès que le test est validé.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
