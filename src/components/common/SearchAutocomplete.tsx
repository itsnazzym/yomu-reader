import React, { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon";

interface SearchAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
}

const COMMON_TAG_PRESETS = [
  { prefix: "language:", label: "Langue", icon: "language", values: ["french", "english", "japanese", "chinese", "spanish"] },
  { prefix: "category:", label: "Catégorie", icon: "category", values: ["doujinshi", "manga", "artistcg", "western", "non-h"] },
  { prefix: "artist:", label: "Artiste", icon: "brush", values: ["matsumoto", "shindol", "asagi", "akagi", "mizuryu kei"] },
  { prefix: "parody:", label: "Série / Parodie", icon: "movie", values: ["original", "fate grand order", "genshin impact", "blue archive", "kantai collection"] },
  { prefix: "tag:", label: "Tag populaire", icon: "sell", values: ["sole female", "sole male", "big breasts", "schoolgirl uniform", "stockings", "glasses", "milf", "maid", "nakadashi", "ahegao"] },
];

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Rechercher par titre, tag, artiste ou code...",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive active word under typing
  const words = value.split(/\s+/);
  const lastWord = words[words.length - 1] || "";

  // Suggestions computation
  const suggestions = React.useMemo(() => {
    const list: { text: string; label: string; icon: string; category: string }[] = [];
    const query = lastWord.toLowerCase().trim();

    if (!query) {
      // Show default top categories
      COMMON_TAG_PRESETS.forEach((preset) => {
        preset.values.slice(0, 3).forEach((val) => {
          list.push({
            text: `${preset.prefix}${val}`,
            label: `${preset.prefix}${val}`,
            icon: preset.icon,
            category: preset.label,
          });
        });
      });
      return list.slice(0, 8);
    }

    // Filter matching presets
    COMMON_TAG_PRESETS.forEach((preset) => {
      preset.values.forEach((val) => {
        const full = `${preset.prefix}${val}`;
        if (full.toLowerCase().includes(query) || val.toLowerCase().includes(query)) {
          list.push({
            text: val.includes(" ") && !preset.prefix ? `"${val}"` : `${preset.prefix}${val}`,
            label: `${preset.prefix}${val}`,
            icon: preset.icon,
            category: preset.label,
          });
        }
      });
    });

    return list.slice(0, 10);
  }, [lastWord]);

  const handleSelectSuggestion = (sugText: string) => {
    const newWords = [...words];
    newWords[newWords.length - 1] = sugText;
    const nextQuery = newWords.join(" ") + " ";
    onChange(nextQuery);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (isOpen && highlightIndex >= 0 && suggestions[highlightIndex]) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightIndex].text);
      } else {
        setIsOpen(false);
        onSubmit();
      }
    } else if (e.key === "ArrowDown") {
      if (isOpen && suggestions.length > 0) {
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === "ArrowUp") {
      if (isOpen && suggestions.length > 0) {
        e.preventDefault();
        setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative flex-1 ${className}`}>
      <div className="flex items-stretch w-full">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-[#25252e] text-white placeholder-gray-400 px-4 py-1.5 rounded-l-md text-sm outline-none border border-[#333340] border-r-0 focus:bg-[#2b2b36] transition-colors"
        />
        <button
          onClick={() => {
            setIsOpen(false);
            onSubmit();
          }}
          className="bg-[#ed2553] hover:bg-[#f43f5e] text-white px-4 rounded-r-md flex items-center justify-center transition-colors shadow-sm cursor-pointer"
          title="Lancer la recherche"
        >
          <Icon name="search" size={20} />
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c1c24] border border-[#333345] rounded-lg shadow-2xl overflow-hidden z-50 divide-y divide-[#262633]">
          <div className="px-3 py-1.5 bg-[#17171e] text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>Suggestions de tags</span>
            <span className="text-[9px] font-mono text-gray-500">Entrée pour choisir</span>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectSuggestion(sug.text)}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors cursor-pointer ${
                  highlightIndex === idx ? "bg-[#ed2553] text-white" : "text-gray-200 hover:bg-[#252532]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon
                    name={sug.icon}
                    size={14}
                    className={highlightIndex === idx ? "text-white" : "text-[#ed2553]"}
                  />
                  <span className="font-mono font-medium truncate">{sug.label}</span>
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    highlightIndex === idx
                      ? "bg-white/20 text-white"
                      : "bg-[#282836] text-gray-400"
                  }`}
                >
                  {sug.category}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
