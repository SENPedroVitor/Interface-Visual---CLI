import React, { type ComponentPropsWithoutRef, type CSSProperties } from "react";
import { cn } from "../lib/utils";
import "./ShimmerButton.css";

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ShimmerButton = React.forwardRef<
  HTMLButtonElement,
  ShimmerButtonProps
>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "rgba(0, 0, 0, 1)",
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        style={
          {
            "--spread": "90deg",
            "--shimmer-color": shimmerColor,
            "--radius": borderRadius,
            "--speed": shimmerDuration,
            "--cut": shimmerSize,
            "--bg": background,
            ...style,
          } as CSSProperties
        }
        className={cn("shimmer-button", className)}
        ref={ref}
        {...props}
      >
        {/* spark container */}
        <div className="shimmer-spark-container">
          {/* spark */}
          <div className="shimmer-spark">
            {/* spark before */}
            <div className="shimmer-spark-spin" />
          </div>
        </div>

        {/* content */}
        <span className="shimmer-button-content">{children}</span>

        {/* Highlight */}
        <div className="shimmer-highlight" />

        {/* backdrop */}
        <div className="shimmer-backdrop" />
      </button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";
