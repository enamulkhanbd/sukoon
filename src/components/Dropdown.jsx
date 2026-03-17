import { useState, useRef, useEffect } from 'react';

/**
 * Reusable dropdown component.
 * @param {object} props
 * @param {string} props.label - Current selected label text
 * @param {Array} props.options - Array of { value, label, isSelected }
 * @param {function} props.onSelect - Callback when option is chosen
 * @param {string} [props.className] - Additional CSS for the root
 * @param {string} [props.btnClassName] - Additional CSS for the trigger button
 * @param {string} [props.menuClassName] - Additional CSS for the menu
 */
export default function Dropdown({
  label,
  options,
  onSelect,
  className = '',
  btnClassName = '',
  menuClassName = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 outline-none cursor-pointer transition-colors ${btnClassName}`}
      >
        <span className="truncate">{label}</span>
        <i
          className={`fa-solid fa-chevron-down text-[10px] opacity-70 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-2 bg-[#FCFAF5] border border-[#e8dcb8] py-1.5 z-20 flex flex-col max-h-64 overflow-y-auto custom-scrollbar transform origin-top animate-dropdown ${menuClassName}`}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`text-left px-4 py-2.5 text-sm transition-colors font-medium w-full border-b border-[#e8dcb8]/50 last:border-0 ${
                opt.isSelected
                  ? 'text-gold bg-gold/5'
                  : 'text-sepia-dark/80 hover:bg-sepia-dark/5 hover:text-gold'
              }`}
              onClick={() => {
                onSelect(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
