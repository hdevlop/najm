"use client";

import { useEffect, useState, useRef } from "react";

interface CodeTypingAnimationProps {
  code: string;
  highlightedCode: string;
  speed?: number;
  className?: string;
}

export function CodeTypingAnimation({
  code,
  highlightedCode,
  speed = 30,
  className = "",
}: CodeTypingAnimationProps) {
  const [displayedCode, setDisplayedCode] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentIndex = useRef(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || isComplete) return;

    const interval = setInterval(() => {
      if (currentIndex.current < code.length) {
        setDisplayedCode(code.slice(0, currentIndex.current + 1));
        currentIndex.current++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [isVisible, code, speed, isComplete]);

  // Create a version of the highlighted code that only shows the typed portion
  const getPartialHighlightedCode = () => {
    if (isComplete) {
      return highlightedCode;
    }

    // Create a temporary div to parse the highlighted HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = highlightedCode;

    // Get the text content and compare with displayed code length
    const textContent = tempDiv.textContent || "";
    if (displayedCode.length >= textContent.length) {
      return highlightedCode;
    }

    // Simple approach: show partial content
    // This is a simplified version - for production you might want more sophisticated HTML truncation
    const percentage = (displayedCode.length / code.length) * 100;
    return `<div style="position: relative;">
      ${highlightedCode}
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #282c34; clip-path: inset(0 0 0 ${percentage}%);"></div>
    </div>`;
  };

  return (
    <div ref={containerRef} className={className}>
      <div className="rounded-lg border border-[#3e4451] bg-[#282c34] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#3e4451] bg-[#21252b] px-4 py-2">
          <span className="text-sm text-[#abb2bf]">server.ts</span>
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[#e06c75]" />
            <div className="h-3 w-3 rounded-full bg-[#e5c07b]" />
            <div className="h-3 w-3 rounded-full bg-[#98c379]" />
          </div>
        </div>
        <div className="relative overflow-x-auto text-sm p-4 [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 min-h-[400px]">
          {isComplete ? (
            <div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
          ) : (
            <pre className="text-[#abb2bf] font-mono">
              <code>{displayedCode}</code>
              <span className="inline-block w-2 h-5 bg-[#abb2bf] animate-pulse ml-0.5" />
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
