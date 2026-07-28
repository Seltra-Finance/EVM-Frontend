"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PairConfig } from "@/config/seltra.config";
import { displaySymbol, TokenIcon } from "@/components/token-icon";

// One accessible pair picker used everywhere a market can be changed: a
// popover on desktop, a bottom sheet on mobile (CSS-driven, no JS breakpoint
// detection so it never mismatches on hydration). The caller decides what
// "selecting a pair" means — navigate (Trade) or just update state (Stats).

export function MarketSwitcher({
  pairs,
  selectedPairId,
  onSelect,
  label = "Market",
}: {
  pairs: PairConfig[];
  selectedPairId: string;
  onSelect: (pairId: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = pairs.find((pair) => pair.id === selectedPairId) ?? pairs[0];

  useEffect(() => {
    if (!open) return;
    setActiveIndex(Math.max(0, pairs.findIndex((pair) => pair.id === selectedPairId)));
    const onOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open, pairs, selectedPairId]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(pairId: string) {
    onSelect(pairId);
    close(true);
  }

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % pairs.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + pairs.length) % pairs.length);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(pairs.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(pairs[activeIndex].id);
    }
  }

  if (!selected) return null;

  return (
    <div className="market-switcher" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="market-switcher-trigger dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected.base} / ${selected.quote}. Change market`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="market-switcher-symbols">
          <TokenIcon symbol={selected.base} size={16} />
          <strong>{displaySymbol(selected.base)}</strong>
          <span className="market-switcher-sep">/</span>
          <TokenIcon symbol={selected.quote} size={16} />
          <span>{displaySymbol(selected.quote)}</span>
        </span>
        <ChevronDown size={14} className="dropdown-chevron" aria-hidden />
      </button>
      {open ? (
        <>
          <div className="market-switcher-backdrop" onClick={() => close(false)} aria-hidden />
          <div
            className="market-switcher-panel"
            role="listbox"
            aria-label={label}
            aria-activedescendant={`market-switcher-option-${activeIndex}`}
            onKeyDown={onListKeyDown}
          >
            <p className="market-switcher-panel-title">{label}</p>
            <div className="market-switcher-options">
              {pairs.map((pair, index) => {
                const isSelected = pair.id === selectedPairId;
                return (
                  <button
                    key={pair.id}
                    id={`market-switcher-option-${index}`}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={index === activeIndex ? 0 : -1}
                    className={`market-switcher-option ${isSelected ? "selected" : ""}`}
                    onClick={() => choose(pair.id)}
                    onFocus={() => setActiveIndex(index)}
                  >
                    <span className="market-switcher-option-main">
                      <span className="market-switcher-option-symbols">
                        <TokenIcon symbol={pair.base} size={18} />
                        <strong>{displaySymbol(pair.base)}</strong>
                        <span className="market-switcher-sep">/</span>
                        <TokenIcon symbol={pair.quote} size={18} />
                        <span>{displaySymbol(pair.quote)}</span>
                      </span>
                      <span className="market-switcher-option-desc">Spot pair · {pair.pricePrecision}dp price</span>
                    </span>
                    {isSelected ? <Check size={15} aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
