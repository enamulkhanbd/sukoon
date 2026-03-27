import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hook to detect mobile viewport.
 */
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Search input used in both dropdown and bottom sheet.
 */
function SearchInput({ searchQuery, setSearchQuery, searchPlaceholder, inputRef }) {
  return (
    <div className="relative">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sepia-dark/40"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full pl-8 pr-8 py-2.5 text-sm bg-sepia-dark/5 rounded-lg border border-[#e8dcb8]/40 text-sepia-dark placeholder-sepia-dark/35 outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all font-montserrat"
      />
      {searchQuery && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSearchQuery('');
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sepia-dark/40 hover:text-sepia-dark/70 transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Options list used in both dropdown and bottom sheet.
 */
function OptionsList({ filteredOptions, onSelect, onToggleFavorite, showFavorites, listRef, isBottomSheet = false }) {
  return (
    <div
      ref={listRef}
      className={`overflow-y-auto custom-scrollbar ${
        isBottomSheet ? 'flex-1 pb-[env(safe-area-inset-bottom,16px)]' : 'max-h-64 py-1.5'
      }`}
    >
      {filteredOptions.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-sepia-dark/40 font-montserrat flex flex-col items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          No results found
        </div>
      ) : (
        filteredOptions.map((opt) => (
          <div
            key={opt.value}
            data-selected={opt.isSelected}
            className={`group flex items-center transition-colors border-b border-[#e8dcb8]/30 last:border-0 ${
              opt.isSelected
                ? 'bg-gold/5'
                : 'hover:bg-sepia-dark/5 active:bg-sepia-dark/8'
            }`}
          >
            <button
              className={`flex-1 text-left px-5 font-medium outline-none ${
                isBottomSheet ? 'py-3.5 text-[15px]' : 'py-2.5 text-sm'
              } ${
                opt.isSelected
                  ? 'text-gold'
                  : 'text-sepia-dark/80 hover:text-gold transition-colors'
              }`}
              onClick={() => onSelect(opt.value)}
            >
              {opt.label}
            </button>
            
            {showFavorites && onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(opt.value);
                }}
                className={`pr-5 py-2 group-hover:opacity-100 transition-all ${
                  opt.isFavorite ? 'opacity-100 text-gold scale-110' : 'opacity-20 hover:opacity-100 text-sepia-dark/40 hover:text-gold hover:scale-110'
                }`}
                aria-label={opt.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={isBottomSheet ? "20" : "16"}
                  height={isBottomSheet ? "20" : "16"}
                  viewBox="0 0 24 24"
                  fill={opt.isFavorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Bottom sheet component for mobile view.
 */
function BottomSheet({
  isOpen,
  onClose,
  title,
  searchable,
  searchPlaceholder,
  searchQuery,
  setSearchQuery,
  filteredOptions,
  onSelect,
  onToggleFavorite,
  showFavorites,
  searchInputRef,
  listRef,
}) {
  const sheetRef = useRef(null);
  const dragRef = useRef({ startY: 0, currentY: 0, isDragging: false });
  const [isClosing, setIsClosing] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Focus search after the slide-up animation
      if (searchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 350);
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, searchable, searchInputRef]);

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      setTimeout(() => {
        const selectedEl = listRef.current?.querySelector('[data-selected="true"]');
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      }, 350);
    }
  }, [isOpen, listRef]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

  // Touch drag-to-dismiss
  const handleTouchStart = (e) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    dragRef.current.startY = e.touches[0].clientY;
    dragRef.current.isDragging = true;
    sheet.style.transition = 'none';
  };

  const handleTouchMove = (e) => {
    if (!dragRef.current.isDragging) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const deltaY = e.touches[0].clientY - dragRef.current.startY;
    if (deltaY > 0) {
      sheet.style.transform = `translateY(${deltaY}px)`;
      dragRef.current.currentY = deltaY;
    }
  };

  const handleTouchEnd = () => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = '';
    if (dragRef.current.currentY > 120) {
      handleClose();
    } else {
      sheet.style.transform = '';
    }
    dragRef.current.currentY = 0;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="bottom-sheet-overlay" data-closing={isClosing || undefined}>
      {/* Backdrop */}
      <div
        className="bottom-sheet-backdrop"
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="bottom-sheet-container"
        data-closing={isClosing || undefined}
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
      >
        {/* Drag handle */}
        <div
          className="bottom-sheet-handle-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="bottom-sheet-handle" />
        </div>

        {/* Title */}
        <div className="bottom-sheet-header">
          <h3 className="font-montserrat text-sm font-semibold text-sepia-dark/70 tracking-wide uppercase">
            {title}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-sepia-dark/10 transition-colors cursor-pointer text-sepia-dark/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        {searchable && (
          <div className="p-4 border-b border-[#e8dcb8]/40">
            <SearchInput
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchPlaceholder={searchPlaceholder}
              inputRef={searchInputRef}
            />
          </div>
        )}

        {/* Options */}
        <OptionsList
          filteredOptions={filteredOptions}
          onSelect={(value) => {
            onSelect(value);
            handleClose();
          }}
          onToggleFavorite={onToggleFavorite}
          showFavorites={showFavorites}
          listRef={listRef}
          isBottomSheet={true}
        />
      </div>
    </div>,
    document.body
  );
}

/**
 * Reusable dropdown component with optional search and mobile bottom sheet.
 */
export default function Dropdown({
  label,
  options,
  onSelect,
  searchable = false,
  searchPlaceholder = 'Search...',
  bottomSheetTitle = 'Select',
  className = '',
  btnClassName = '',
  menuClassName = '',
  onToggleFavorite,
  showFavorites = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const dropdownPortalRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const isMobile = useIsMobile();

  // Close on outside click (desktop only)
  useEffect(() => {
    if (isMobile) return;
    function handleClickOutside(e) {
      const inContainer = containerRef.current?.contains(e.target);
      const inPortal = dropdownPortalRef.current?.contains(e.target);
      if (!inContainer && !inPortal) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMobile]);

  // Auto-focus search input when dropdown opens (desktop)
  useEffect(() => {
    if (isMobile) return;
    if (isOpen && searchable && searchInputRef.current) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, searchable, isMobile]);

  // Filter and sort options based on search query and favorites
  const filteredOptions = useMemo(() => {
    // 1. Start with the base options
    let result = [...options];

    // 2. Sort favorites to the top if showFavorites is enabled
    if (showFavorites) {
      result.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return 0; // maintain original relative order (which is 1 to 114)
      });
    }

    // 3. Filter if searching
    if (searchable && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((opt) => opt.label.toLowerCase().includes(q));
    }

    return result;
  }, [options, searchQuery, searchable, showFavorites]);

  // Scroll selected item into view when dropdown opens (desktop)
  useEffect(() => {
    if (isMobile) return;
    if (isOpen && listRef.current) {
      requestAnimationFrame(() => {
        const selectedEl = listRef.current?.querySelector('[data-selected="true"]');
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      });
    }
  }, [isOpen, isMobile]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={!isMobile ? handleKeyDown : undefined}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 outline-none cursor-pointer transition-colors ${btnClassName}`}
      >
        <span className="truncate">{label}</span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="1em" 
          height="1em" 
          viewBox="0 0 512 512" 
          fill="currentColor"
          className={`text-[10px] opacity-70 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/>
        </svg>
      </button>

      {/* Desktop dropdown via portal */}
      {isOpen && !isMobile && (() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return null;
        return createPortal(
          <div
            ref={dropdownPortalRef}
            className={`fixed z-50 bg-[#FCFAF5] border border-[#e8dcb8] flex flex-col transform origin-top animate-dropdown shadow-lg overflow-hidden ${menuClassName}`}
            style={{
              top: rect.bottom + 8,
              left: rect.left,
              minWidth: Math.max(rect.width, 280),
            }}
          >
            {searchable && (
              <div className="sticky top-0 bg-[#FCFAF5] border-b border-[#e8dcb8]/60 p-4 z-10">
                <SearchInput
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchPlaceholder={searchPlaceholder}
                  inputRef={searchInputRef}
                />
              </div>
            )}
            <OptionsList
              filteredOptions={filteredOptions}
              onSelect={(value) => {
                onSelect(value);
                setIsOpen(false);
                setSearchQuery('');
              }}
              onToggleFavorite={onToggleFavorite}
              showFavorites={showFavorites}
              listRef={listRef}
            />
          </div>,
          document.body
        );
      })()}

      {/* Mobile bottom sheet */}
      {isMobile && searchable && (
        <BottomSheet
          isOpen={isOpen}
          onClose={handleClose}
          title={bottomSheetTitle}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredOptions={filteredOptions}
          onSelect={(value) => {
            onSelect(value);
          }}
          onToggleFavorite={onToggleFavorite}
          showFavorites={showFavorites}
          searchInputRef={searchInputRef}
          listRef={listRef}
        />
      )}

      {/* Mobile non-searchable dropdown (standard) */}
      {isOpen && isMobile && !searchable && (
        <div
          className={`absolute top-full mt-2 bg-[#FCFAF5] border border-[#e8dcb8] z-20 flex flex-col transform origin-top animate-dropdown overflow-hidden ${menuClassName}`}
        >
          <OptionsList
            filteredOptions={filteredOptions}
            onSelect={(value) => {
              onSelect(value);
              setIsOpen(false);
              setSearchQuery('');
            }}
            onToggleFavorite={onToggleFavorite}
            showFavorites={showFavorites}
            listRef={listRef}
          />
        </div>
      )}
    </div>
  );
}
