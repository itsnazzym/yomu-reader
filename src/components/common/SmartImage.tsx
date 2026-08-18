import React, { useState, useEffect, useCallback, useRef } from "react";

interface SmartImageProps {
  candidates: string[];
  alt?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  referer?: string;
  onClick?: (e: React.MouseEvent) => void;
  onLoadSuccess?: () => void;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  candidates,
  alt = "",
  className = "",
  imgClassName = "",
  priority = false,
  onClick,
  onLoadSuccess,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const mountedRef = useRef(true);

  const validSources = React.useMemo(() => {
    return Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  }, [candidates]);

  useEffect(() => {
    mountedRef.current = true;
    setCurrentIdx(0);
    setIsLoading(true);
    setHasError(false);

    return () => {
      mountedRef.current = false;
    };
  }, [validSources.join("|")]);

  // Automatic 2.5s failover timer in case a mirror hangs or is throttled
  useEffect(() => {
    if (!isLoading || hasError || validSources.length <= 1) return;
    const timer = setTimeout(() => {
      if (mountedRef.current && isLoading) {
        if (currentIdx + 1 < validSources.length) {
          setCurrentIdx((prev) => prev + 1);
        }
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [currentIdx, isLoading, hasError, validSources]);

  const handleImgLoad = useCallback(() => {
    if (!mountedRef.current) return;
    setIsLoading(false);
    setHasError(false);
    onLoadSuccess?.();
  }, [onLoadSuccess]);

  const handleImgError = useCallback(() => {
    if (!mountedRef.current) return;
    if (currentIdx + 1 < validSources.length) {
      // Advance to next mirror or format fallback immediately
      setCurrentIdx((prev) => prev + 1);
      setIsLoading(true);
    } else {
      // All fallback sources failed
      setIsLoading(false);
      setHasError(true);
    }
  }, [currentIdx, validSources.length]);

  if (validSources.length === 0) {
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden flex items-center justify-center bg-[#181824] ${className}`}
      >
        <div className="flex flex-col items-center justify-center p-2 text-gray-500 text-[10px] text-center gap-1">
          <span className="text-base">⚠️</span>
          <span>Image indisponible</span>
        </div>
      </div>
    );
  }

  const currentSrc = validSources[currentIdx];

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden flex items-center justify-center bg-[#181824] ${className}`}
    >
      {/* Loading Skeleton Spinner */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#161622] animate-pulse flex items-center justify-center z-10 pointer-events-none">
          <div className="w-4 h-4 border-2 border-[#ed2553] border-t-transparent rounded-full animate-spin opacity-75" />
        </div>
      )}

      {/* Error Fallback */}
      {hasError ? (
        <div className="flex flex-col items-center justify-center p-2 text-gray-500 text-[10px] text-center gap-1">
          <span className="text-base">⚠️</span>
          <span>Image indisponible</span>
        </div>
      ) : (
        <img
          key={currentSrc}
          src={currentSrc}
          alt={alt}
          loading="eager"
          decoding={priority ? "sync" : "async"}
          onLoad={handleImgLoad}
          onError={handleImgError}
          className={`w-full h-full object-cover transition-opacity duration-150 ${
            isLoading ? "opacity-0" : "opacity-100"
          } ${imgClassName}`}
        />
      )}
    </div>
  );
};
