import type { QualityLevel } from "@/hooks/useAdaptiveQuality";
import { useIsMobile } from "@/hooks/use-mobile";

interface CRTOverlayProps {
  quality: QualityLevel;
  crtEnabled?: boolean;
}

const CRTOverlay = ({ quality, crtEnabled = true }: CRTOverlayProps) => {
  const isMobile = useIsMobile();
  
  // Disable CRT on mobile, potato/low quality, or when user toggled off
  if (isMobile || quality === 'low' || quality === 'potato' || !crtEnabled) {
    return null;
  }
  
  const qualityClass = quality === 'high' ? 'crt-high' : quality === 'medium' ? 'crt-medium' : '';
  
  return (
    <>
      {/* Scanline overlay */}
      <div className={`crt-scanlines ${qualityClass}`} />
      
      {/* Screen curvature and vignette effect */}
      <div className={`crt-screen ${qualityClass}`} />
      
      {/* Phosphor glow effect */}
      <div className={`crt-phosphor ${qualityClass}`} />
    </>
  );
};

export default CRTOverlay;
