import React from "react";
import { Tag } from "../../types";

interface TagBadgeProps {
  tag: Tag;
  onClick?: (tag: Tag) => void;
  onExclude?: (tag: Tag) => void;
  showCount?: boolean;
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  tag,
  onClick,
  onExclude,
  showCount = true,
}) => {
  const getTagClass = (type: string) => {
    switch (type) {
      case "artist":
        return "tag-artist";
      case "group":
        return "tag-group";
      case "parody":
        return "tag-parody";
      case "character":
        return "tag-character";
      case "category":
        return "tag-category";
      case "language":
        return "tag-language";
      default:
        return "tag-tag";
    }
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toString();
  };

  return (
    <span
      onClick={() => onClick && onClick(tag)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 select-none ${
        onClick ? "cursor-pointer hover:brightness-125 hover:scale-[1.02]" : ""
      } ${getTagClass(tag.type)}`}
      title={`${tag.type}: ${tag.name}`}
    >
      <span className="font-semibold">{tag.name}</span>
      {showCount && tag.count > 0 && (
        <span className="opacity-60 text-[10px] font-mono">
          {formatCount(tag.count)}
        </span>
      )}
      {onExclude && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExclude(tag);
          }}
          className="ml-0.5 hover:text-red-400 font-bold"
          title="Exclure ce tag"
        >
          ×
        </button>
      )}
    </span>
  );
};
