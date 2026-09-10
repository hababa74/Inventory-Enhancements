import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * True for phones/tablets: narrow screens, short landscape screens (phone
 * held sideways) and any touch device. The desktop lobby layout needs real
 * vertical space, so short landscape phones must use the mobile layout too.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      setIsMobile(w < MOBILE_BREAKPOINT || h < 560 || coarse);
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  return !!isMobile;
}
