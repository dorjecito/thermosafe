import { useEffect, useState } from "react";

export function useScrollCompactHeader(threshold = 120) {
  const [showCompactHeader, setShowCompactHeader] = useState(false);

  useEffect(() => {
    // Evita que Chrome restauri una posició antiga de scroll
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // Estat inicial sempre normal
    setShowCompactHeader(false);

    const handleScroll = () => {
      const shouldShow = window.scrollY > threshold;
      setShowCompactHeader(shouldShow);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [threshold]);

  return showCompactHeader;
}