import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { LuCheck, LuChevronDown } from 'react-icons/lu';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface DropdownProps<T extends string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  renderTrigger?: (props: { option: DropdownOption<T>; isOpen: boolean }) => ReactNode;
  align?: 'left' | 'right';
  disabled?: boolean;
}

export function Dropdown<T extends string>({
  options,
  value,
  onChange,
  renderTrigger,
  align = 'left',
  disabled,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0]!;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        className="disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {renderTrigger ? (
          renderTrigger({ option: selectedOption, isOpen })
        ) : (
          <span className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
            {selectedOption.label}
            <LuChevronDown size={12} className={isOpen ? 'rotate-180' : ''} />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-full mb-1 z-50 min-w-[160px] rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl shadow-black/40 py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-700/60 transition-colors"
            >
              <span className="w-4 shrink-0">
                {option.value === value && <LuCheck size={14} className="text-amber-400" />}
              </span>
              <div className="flex flex-col">
                <span className={option.value === value ? 'text-zinc-200' : 'text-zinc-400'}>
                  {option.label}
                </span>
                {option.description && (
                  <span className="text-xs text-zinc-600">{option.description}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
