"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface SectionPagerProps {
  sections: Section[];
  activeSectionId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const SectionPager = ({ sections, activeSectionId, onChange, className }: SectionPagerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const idx = sections.findIndex((s) => s.id === activeSectionId);
    if (idx >= 0 && idx !== activeIndex) {
      setActiveIndex(idx);
      if (containerRef.current) {
        const child = containerRef.current.children[idx] as HTMLElement;
        if (child) {
          containerRef.current.scrollTo({
            left: child.offsetLeft,
            behavior: "smooth"
          });
        }
      }
    }
  }, [activeSectionId, sections, activeIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;
    const width = containerRef.current.offsetWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < sections.length) {
      setActiveIndex(newIndex);
      onChange(sections[newIndex].id);
    }
  };

  return (
    <div className={cn("flex flex-col w-full h-full", className)}>
      <div className="sticky top-[56px] z-40 bg-surface/80 backdrop-blur-md border-b border-white/20 pb-2">
        <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 py-2">
          {sections.map((sec, i) => (
            <button
              key={sec.id}
              onClick={() => onChange(sec.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                activeSectionId === sec.id
                  ? "bg-brand text-white shadow-md"
                  : "bg-surface-secondary text-ink-muted hover:text-ink"
              )}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex w-full flex-1 overflow-x-auto snap-x snap-mandatory no-scrollbar"
        style={{ scrollBehavior: "smooth" }}
      >
        {sections.map((sec) => (
          <div key={sec.id} className="min-w-full w-full snap-start shrink-0 p-4">
            {sec.id === activeSectionId || sec.id === "home" ? sec.content : <div className="animate-pulse flex flex-col space-y-4"><div className="h-32 bg-surface-secondary rounded-xl"></div></div>}
          </div>
        ))}
      </div>
    </div>
  );
};