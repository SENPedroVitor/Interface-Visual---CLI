import React, { forwardRef, useState, useCallback, useMemo } from 'react';
import { cn } from '../lib/utils';
import './TypingIndicator.css';

export type TypingIndicatorVariant = 'bubble' | 'inline';
export type TypingIndicatorSize = 'sm' | 'md' | 'lg';

export interface TypingIndicatorAvatar {
  src: string;
  alt?: string;
}

export interface TypingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: TypingIndicatorVariant;
  size?: TypingIndicatorSize;
  name?: string;
  names?: string[];
  avatar?: TypingIndicatorAvatar;
  locale?: 'pt' | 'en';
  className?: string;
}

function buildTypingSentence(names: string[], locale: 'pt' | 'en'): string {
  const isPt = locale === 'pt';

  if (!names.length) {
    return isPt ? 'Alguém está digitando…' : 'Someone is typing…';
  }

  if (names.length === 1) {
    return isPt ? `${names[0]} está digitando…` : `${names[0]} is typing…`;
  }

  if (names.length === 2) {
    return isPt
      ? `${names[0]} e ${names[1]} estão digitando…`
      : `${names[0]} and ${names[1]} are typing…`;
  }

  const remaining = names.length - 1;
  return isPt
    ? `${names[0]} e mais ${remaining} estão digitando…`
    : `${names[0]} and ${remaining} others are typing…`;
}

export const TypingIndicator = forwardRef<HTMLDivElement, TypingIndicatorProps>(
  (
    {
      variant = 'bubble',
      size = 'md',
      name,
      names,
      avatar,
      locale = 'pt',
      className,
      ...props
    },
    ref
  ) => {
    // 1. Resolve names list: `names` wins over `name`
    const resolvedNames = useMemo(() => {
      if (names && names.length > 0) return names.filter(Boolean);
      if (name && name.trim()) return [name.trim()];
      return [];
    }, [name, names]);

    const hasKnownName = resolvedNames.length > 0;
    const sentence = useMemo(() => buildTypingSentence(resolvedNames, locale), [resolvedNames, locale]);

    // 2. Avatar resilience logic:
    // Probe onError + ref callback on mount (complete && naturalWidth === 0)
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const isImageFailed = Boolean(avatar?.src && failedSrc === avatar.src);

    const imgRefCallback = useCallback(
      (img: HTMLImageElement | null) => {
        if (img && img.complete && img.naturalWidth === 0 && avatar?.src) {
          setFailedSrc(avatar.src);
        }
      },
      [avatar?.src]
    );

    const initial = useMemo(() => {
      const source = resolvedNames[0] || avatar?.alt || 'A';
      return source.charAt(0).toUpperCase();
    }, [resolvedNames, avatar?.alt]);

    // 3. Dots component with frozen opacity variables for reduced motion
    const dotsElement = (
      <span className="typing-indicator-dots" aria-hidden="true">
        <span
          className="typing-indicator-dot"
          style={{ '--resting-opacity': 0.4 } as React.CSSProperties}
        />
        <span
          className="typing-indicator-dot"
          style={{ '--resting-opacity': 0.7 } as React.CSSProperties}
        />
        <span
          className="typing-indicator-dot"
          style={{ '--resting-opacity': 1.0 } as React.CSSProperties}
        />
      </span>
    );

    // 4. Render Avatar
    const renderAvatar = () => {
      if (!avatar?.src || isImageFailed) {
        return (
          <div
            className="typing-indicator-avatar-fallback"
            aria-hidden="true"
            title={avatar?.alt || resolvedNames[0]}
          >
            {initial}
          </div>
        );
      }

      return (
        <img
          ref={imgRefCallback}
          src={avatar.src}
          alt={avatar.alt || resolvedNames[0] || 'Avatar'}
          className="typing-indicator-avatar"
          onError={() => {
            if (avatar?.src) setFailedSrc(avatar.src);
          }}
        />
      );
    };

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        data-slot="typing-indicator"
        data-variant={variant}
        data-size={size}
        className={cn('typing-indicator-root', className)}
        {...props}
      >
        {variant === 'bubble' ? (
          <>
            {/* Sentence visible above bubble when names known, sr-only otherwise */}
            {hasKnownName ? (
              <span className="typing-indicator-label">{sentence}</span>
            ) : (
              <span className="typing-indicator-sr-only">{sentence}</span>
            )}

            <div className="typing-indicator-body">
              {avatar && renderAvatar()}
              <div className="typing-indicator-bubble">{dotsElement}</div>
            </div>
          </>
        ) : (
          /* Inline variant: dots first, then sentence (or sr-only) */
          <>
            {avatar && renderAvatar()}
            {dotsElement}
            {hasKnownName ? (
              <span className="typing-indicator-label">{sentence}</span>
            ) : (
              <span className="typing-indicator-sr-only">{sentence}</span>
            )}
          </>
        )}
      </div>
    );
  }
);

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
