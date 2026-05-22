"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "fullscreen";
  text?: string;
}

export const AnimatedLoader = ({ className, size = "md", text }: AnimatedLoaderProps) => {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-24 h-24",
    lg: "w-32 h-32",
    fullscreen: "w-32 h-32"
  };

  const containerClasses = size === "fullscreen" 
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface-glass backdrop-blur-sm"
    : "flex flex-col items-center justify-center p-4";

  return (
    <div className={cn(containerClasses, className)}>
      <motion.div
        className={cn("relative", sizeClasses[size])}
        initial={{ y: 0 }}
        animate={{ y: [-5, 5, -5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Shield Arc (Protecting shield) */}
          <motion.path
            d="M 20 50 Q 50 10 80 50"
            stroke="var(--accent-info)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          />
          {/* School Building */}
          <motion.path
            d="M 30 80 L 30 40 L 50 30 L 70 40 L 70 80 Z"
            fill="var(--brand)"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
          <motion.rect x="45" y="60" width="10" height="20" fill="white" />
          <motion.circle cx="50" cy="45" r="4" fill="white" />
          {/* Boy / Student */}
          <motion.circle 
            cx="25" cy="70" r="4" fill="var(--accent-warn)" 
            animate={{ x: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.rect 
            x="23" y="74" width="4" height="6" fill="var(--brand-light)"
            animate={{ x: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </motion.div>
      {text && (
        <motion.p
          className="mt-4 text-sm font-medium text-ink-muted animate-pulse"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};