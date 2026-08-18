import React, { useState, useEffect } from "react";
import { GalleryComment } from "../../types";
import { getGalleryComments } from "../../utils/ipc";
import { Icon } from "../common/Icon";

interface CommentSectionProps {
  galleryId: number;
  cookies?: string;
  apiKey?: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ galleryId, cookies, apiKey }) => {
  const [comments, setComments] = useState<GalleryComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getGalleryComments(galleryId, cookies, apiKey)
      .then((data) => {
        if (isMounted) {
          setComments(data || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Impossible de charger les commentaires.");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [galleryId, cookies, apiKey]);

  const timeAgo = (epoch: number) => {
    if (!epoch) return "";
    const diffSec = Math.floor(Date.now() / 1000 - epoch);
    if (diffSec < 60) return "À l'instant";
    const minutes = Math.floor(diffSec / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `il y a ${days} j`;
    const months = Math.floor(days / 30);
    if (months < 12) return `il y a ${months} mois`;
    return `il y a ${Math.floor(months / 12)} an(s)`;
  };

  const getAvatarUrl = (poster: GalleryComment["poster"]) => {
    if (poster.avatar_url) {
      if (poster.avatar_url.startsWith("http")) return poster.avatar_url;
      return `https://i.nhentai.net/avatars/${poster.avatar_url.replace(/^\//, "")}`;
    }
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(poster.username || "user")}`;
  };

  return (
    <div className="space-y-4 pt-4 border-t border-[#252532]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="chat_bubble" size={20} className="text-[#ed2553]" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Commentaires ({comments.length})
          </h3>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3 bg-[#1e1e26] rounded-lg border border-[#2b2b38] animate-pulse space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#2a2a38]" />
                <div className="h-3 w-28 bg-[#2a2a38] rounded" />
              </div>
              <div className="h-4 w-full bg-[#2a2a38] rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-950/20 border border-rose-800/40 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <Icon name="error" size={16} />
          <span>{error}</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-gray-500 text-xs space-y-1">
          <Icon name="chat" size={28} className="mx-auto text-gray-600 opacity-50" />
          <div>Aucun commentaire pour ce manga pour le moment.</div>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="p-3.5 bg-[#1b1b22] hover:bg-[#1f1f28] transition-colors rounded-lg border border-[#282834] space-y-2 text-xs"
            >
              {/* Header: Avatar, Username, Date, Badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={getAvatarUrl(comment.poster)}
                    alt={comment.poster.username}
                    className="w-7 h-7 rounded-full object-cover bg-[#2a2a36] border border-white/10"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                        comment.poster.username
                      )}`;
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-200">{comment.poster.username}</span>
                    {comment.poster.is_superuser && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                        Admin
                      </span>
                    )}
                    {comment.poster.is_staff && (
                      <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-bold">
                        Staff
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 font-mono">
                  {timeAgo(comment.post_date)}
                </div>
              </div>

              {/* Body */}
              <div className="text-gray-300 leading-relaxed break-words whitespace-pre-wrap pl-9">
                {comment.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
