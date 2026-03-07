import { useState, useEffect } from 'react';

/**
 * Hook para detectar se o dispositivo é mobile/tablet
 * Usa breakpoint de 768px (md do Tailwind)
 */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // Verificação inicial no servidor (SSR safe)
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Verificar também pelo user agent para casos de zoom
    const checkMobile = () => {
      const width = window.innerWidth;
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      
      // Considerar mobile se largura < 768px OU se for user agent mobile
      setIsMobile(width < 768 || isMobileUserAgent);
    };

    checkMobile();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  return isMobile;
};

