import React, { useEffect, useState, useRef } from "react";

interface FastScrollRailProps {
  totalPages: number;
  currentPage: number;
  onPageSelect: (pageNum: number) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const FastScrollRail: React.FC<FastScrollRailProps> = ({
  totalPages,
  currentPage,
  onPageSelect,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [dragPage, setDragPage] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const removeDragListenersRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      removeDragListenersRef.current?.();
      removeDragListenersRef.current = null;
    };
  }, []);

  const calculatePageFromY = (clientY: number) => {
    if (!railRef.current) return 1;
    const rect = railRef.current.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const ratio = relativeY / rect.height;
    const targetPage = Math.max(1, Math.min(totalPages, Math.round(ratio * (totalPages - 1)) + 1));
    return targetPage;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    removeDragListenersRef.current?.();
    const page = calculatePageFromY(e.clientY);
    setDragPage(page);
    onPageSelect(page - 1);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const movedPage = calculatePageFromY(moveEvent.clientY);
      setDragPage(movedPage);
      onPageSelect(movedPage - 1);
    };

    const handleMouseUp = () => {
      setDragPage(null);
      removeDragListenersRef.current?.();
      removeDragListenersRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    removeDragListenersRef.current = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  };

  const activePage = dragPage !== null ? dragPage : currentPage + 1;
  const progressRatio = totalPages > 1 ? (activePage - 1) / (totalPages - 1) : 0;

  return (
    <div
      ref={railRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      className={`fixed right-3 top-24 bottom-24 z-40 flex items-center transition-all duration-200 select-none cursor-pointer ${
        isHovered || dragPage !== null ? "w-8 opacity-100" : "w-3 opacity-40 hover:opacity-100"
      }`}
    >
      {/* Background Track */}
      <div className="w-1.5 h-full mx-auto bg-black/40 backdrop-blur-md rounded-full overflow-hidden relative border border-white/10">
        <div
          className="w-full bg-[#ed2553] transition-all"
          style={{ height: `${progressRatio * 100}%` }}
        />
      </div>

      {/* Draggable Thumb Indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none transition-all duration-75"
        style={{ top: `${progressRatio * 100}%`, transform: "translateY(-50%)" }}
      >
        <div className="w-5 h-5 rounded-full bg-[#ed2553] shadow-lg shadow-[#ed2553]/50 flex items-center justify-center text-white border-2 border-white">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
      </div>

      {/* Floating Tooltip with Current Page */}
      {(isHovered || dragPage !== null) && (
        <div
          className="absolute right-10 px-2.5 py-1 rounded-md bg-black/90 backdrop-blur-md text-white text-xs font-mono font-bold shadow-xl border border-white/20 pointer-events-none whitespace-nowrap flex items-center gap-1.5"
          style={{ top: `${progressRatio * 100}%`, transform: "translateY(-50%)" }}
        >
          <span className="text-[#ed2553]">P.{activePage}</span>
          <span className="text-gray-400 text-[10px]">/ {totalPages}</span>
        </div>
      )}
    </div>
  );
};
