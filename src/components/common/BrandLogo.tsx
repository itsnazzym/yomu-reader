import React from "react";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = "md",
  onClick,
}) => {
  const isSm = size === "sm";
  const isLg = size === "lg";

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2.5 select-none cursor-pointer group"
    >
      {/* Official nHentai Bat-Wing Icon */}
      <div
        className={`relative flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${
          isSm ? "w-8 h-8" : isLg ? "w-11 h-11" : "w-9 h-9"
        }`}
      >
        <svg
          viewBox="0 0 64 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_0_10px_rgba(237,37,83,0.45)]"
        >
          {/* Left Wing (Pink/Magenta #ed2553) */}
          <path
            d="M24 24C18 16 12 11 3 11C6 15 7 19 6 24C9 23 13 24 15 29C17 28 20 28 24 33V24Z"
            fill="#ed2553"
          />
          {/* Right Wing (Pink/Magenta #ed2553) */}
          <path
            d="M40 24C46 16 52 11 61 11C58 15 57 19 58 24C55 23 51 24 49 29C47 28 44 28 40 33V24Z"
            fill="#ed2553"
          />
          {/* Central Bold White 'n' */}
          <text
            x="32"
            y="35"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="26"
            fontWeight="900"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            n
          </text>
        </svg>
      </div>

      {/* Styled nHentai Typography */}
      <div className="flex items-baseline font-black tracking-tight select-none">
        <span
          className={`font-black text-[#ed2553] transition-colors ${
            isSm ? "text-lg" : isLg ? "text-2xl" : "text-xl"
          }`}
          style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
        >
          n
        </span>
        <span
          className={`font-bold text-white transition-colors group-hover:text-gray-100 ${
            isSm ? "text-lg" : isLg ? "text-2xl" : "text-xl"
          }`}
          style={{ fontFamily: "'Inter', -apple-system, sans-serif", letterSpacing: "-0.02em" }}
        >
          Hentai
        </span>
        <span className="text-[10px] text-gray-500 font-mono font-normal ml-0.5 opacity-75">
          .net
        </span>
      </div>
    </div>
  );
};
