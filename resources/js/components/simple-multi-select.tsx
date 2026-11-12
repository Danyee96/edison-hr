// components/simple-multi-select.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Option = {
  value: string;
  label: string;
};

type MultiSelectProps = {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  dropdownHeight?: string;
};

export function SimpleMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options",
  className,
  dropdownHeight = '320px',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.min(rect.width, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const availableBelow = window.innerHeight - rect.bottom - 12;
      const availableAbove = rect.top - 12;
      const preferredHeight = Number.parseInt(String(dropdownHeight), 10) || 320;
      const openUpward = availableBelow < Math.min(preferredHeight, 260) && availableAbove > availableBelow;
      const maxHeight = Math.max(160, Math.min(preferredHeight, (openUpward ? availableAbove : availableBelow) - 8));

      setDropdownStyle({
        position: 'fixed',
        left,
        width,
        zIndex: 70000,
        maxHeight,
        height: maxHeight,
        top: openUpward ? Math.max(8, rect.top - maxHeight - 8) : rect.bottom + 8,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, dropdownHeight, selected.length, searchTerm]);
  
  // Handle selection
  const handleSelect = (value: string) => {
    if (!selected.includes(value)) {
      onChange([...selected, value]);
    }
    setSearchTerm('');
    // Keep focus on the input
    setTimeout(() => {
      const input = containerRef.current?.querySelector('input');
      if (input) input.focus();
    }, 10);
  };
  
  // Handle removal
  const handleRemove = (value: string) => {
    onChange(selected.filter(item => item !== value));
  };
  
  // Filter options based on search term
  const filteredOptions = options.filter(option => 
    // Allow showing already selected options when searching
    (searchTerm || !selected.includes(option.value)) && 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div ref={containerRef} className={`relative w-full max-w-full ${className}`}>
      <div
        className="flex max-h-48 flex-wrap items-center gap-2 overflow-y-auto border border-slate-200 bg-white p-3 rounded-2xl min-h-[60px] cursor-text w-full shadow-sm transition focus-within:border-slate-400"
        onClick={() => setIsOpen(true)}
      >
        {selected.map(value => {
          const option = options.find(o => o.value === value);
          return (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {option?.label || value}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full p-1 hover:bg-slate-200"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(value);
                }}
              >
                <X className="h-3 w-3 text-slate-600" />
              </button>
            </span>
          );
        })}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 outline-none bg-transparent min-w-[150px] w-full text-sm text-slate-700 placeholder:text-slate-400"
        />
      </div>
      
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-200"
          style={dropdownStyle}
        >
          {filteredOptions.length > 0 ? filteredOptions.map(option => (
            <div
              key={option.value}
              className="px-4 py-3 text-base font-medium text-slate-900 cursor-pointer hover:bg-slate-50 transition-colors whitespace-normal break-words"
              onClick={() => {
                handleSelect(option.value);
                setIsOpen(true); // Keep dropdown open after selection
              }}
            >
              {option.label}
            </div>
          )) : (
            <div className="px-4 py-4 text-sm text-slate-500">
              No employees found.
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
