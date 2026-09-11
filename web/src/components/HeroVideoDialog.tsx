import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play, X } from "lucide-react";
import { cn } from "../lib/utils";
import "./HeroVideoDialog.css";

export type AnimationStyle =
  | "from-bottom"
  | "from-center"
  | "from-top"
  | "from-left"
  | "from-right"
  | "fade"
  | "top-in-bottom-out"
  | "left-in-right-out";

export interface HeroVideoProps {
  animationStyle?: AnimationStyle;
  videoSrc: string;
  thumbnailSrc?: string;
  thumbnailAlt?: string;
  className?: string;
}

const animationVariants = {
  "from-bottom": {
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "100%", opacity: 0 },
  },
  "from-center": {
    initial: { scale: 0.5, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.5, opacity: 0 },
  },
  "from-top": {
    initial: { y: "-100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "-100%", opacity: 0 },
  },
  "from-left": {
    initial: { x: "-100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "-100%", opacity: 0 },
  },
  "from-right": {
    initial: { x: "100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "100%", opacity: 0 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  "top-in-bottom-out": {
    initial: { y: "-100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "100%", opacity: 0 },
  },
  "left-in-right-out": {
    initial: { x: "-100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "100%", opacity: 0 },
  },
};

/** Normalizes any video link (YouTube, Vimeo, direct MP4) into an embeddable/playable format. */
export function resolveVideoInfo(rawUrl: string, fallbackThumb?: string) {
  const url = (rawUrl || "").trim();

  // YouTube watch, share or shorts
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`,
      thumbnailUrl:
        fallbackThumb || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      isDirectVideo: false,
    };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return {
      embedUrl: `https://player.vimeo.com/video/${videoId}?autoplay=1`,
      thumbnailUrl: fallbackThumb || `https://vumbnail.com/${videoId}.jpg`,
      isDirectVideo: false,
    };
  }

  // Direct video file (.mp4, .webm, .ogg)
  const isDirect = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
  return {
    embedUrl: url,
    thumbnailUrl: fallbackThumb || "",
    isDirectVideo: isDirect,
  };
}



export function HeroVideoDialog({
  animationStyle = "from-center",
  videoSrc,
  thumbnailSrc,
  thumbnailAlt = "Video thumbnail",
  className,
}: HeroVideoProps) {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const selectedAnimation = animationVariants[animationStyle];
  const { embedUrl, thumbnailUrl, isDirectVideo } = resolveVideoInfo(
    videoSrc,
    thumbnailSrc
  );

  // Close on Escape key
  useEffect(() => {
    if (!isVideoOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsVideoOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVideoOpen]);

  return (
    <div className={cn("hero-video-container", className)}>
      <button
        type="button"
        aria-label="Assistir vídeo"
        className="hero-video-trigger"
        onClick={() => setIsVideoOpen(true)}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={thumbnailAlt}
            loading="lazy"
            className="hero-video-thumb"
          />
        ) : (
          <div className="hero-video-thumb-fallback">
            <span className="hero-video-thumb-title">
              {thumbnailAlt || "Assistir vídeo"}
            </span>
          </div>
        )}

        {/* Play Button Overlay with Glow */}
        <div className="hero-video-overlay">
          <div className="hero-video-play-outer">
            <div className="hero-video-play-inner">
              <Play size={22} className="hero-video-play-icon" fill="currentColor" />
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isVideoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            onClick={() => setIsVideoOpen(false)}
            className="hero-video-modal-backdrop"
          >
            <motion.div
              {...selectedAnimation}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="hero-video-dialog-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                aria-label="Fechar vídeo"
                className="hero-video-close-btn"
                onClick={() => setIsVideoOpen(false)}
              >
                <X size={18} />
              </button>

              {/* Video Player Frame */}
              <div className="hero-video-frame-wrap">
                {isDirectVideo ? (
                  <video
                    src={embedUrl}
                    controls
                    autoPlay
                    className="hero-video-native"
                  >
                    Seu navegador não suporta o elemento de vídeo.
                  </video>
                ) : (
                  <iframe
                    src={embedUrl}
                    title="Hero Video player"
                    className="hero-video-iframe"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HeroVideoDialog;
