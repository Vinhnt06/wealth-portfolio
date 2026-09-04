---
name: YourFin Wealth & DNSE Market System
description: Ultra-high-end financial portfolio dashboard with real-time DNSE market streaming.
colors:
  bg-base: "#09090b"
  bg-surface: "#18181b"
  bg-surface-elevated: "#27272a"
  border-subtle: "rgba(255, 255, 255, 0.08)"
  border-strong: "rgba(255, 255, 255, 0.15)"
  primary: "#10b981"
  primary-hover: "#059669"
  text-main: "#f8fafc"
  text-muted: "#94a3b8"
  text-dim: "#64748b"
  gain: "#10b981"
  gain-bg: "rgba(16, 185, 129, 0.1)"
  loss: "#f43f5e"
  loss-bg: "rgba(244, 63, 94, 0.1)"
  ref-yellow: "#eab308"
  ceiling-purple: "#d946ef"
  floor-cyan: "#06b6d4"
typography:
  headline-lg: { fontFamily: "Geist, Satoshi, sans-serif", fontSize: "32px", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" }
  headline-md: { fontFamily: "Geist, Satoshi, sans-serif", fontSize: "24px", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em" }
  body-md: { fontFamily: "Geist, Satoshi, sans-serif", fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }
  number-mono: { fontFamily: "JetBrains Mono, monospace", fontSize: "13px", fontWeight: 500, letterSpacing: "-0.01em" }
rounded:
  sm: "6px"
  md: "12px"
  lg: "20px"
  xl: "28px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  ticker-bar:
    backgroundColor: "{colors.bg-surface}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.border-subtle}"
  order-book:
    backgroundColor: "{colors.bg-base}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.border-subtle}"
  market-card:
    backgroundColor: "{colors.bg-surface}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.border-subtle}"
---

# YourFin Wealth & DNSE Market System

## Overview
YourFin is a modern, high-precision wealth management and market terminal platform.
Designed with a sleek dark-mode aesthetic for financial professionals and retail investors who require real-time market data streaming with zero latency lag.

## Parameters & Taste Guidelines
- **DESIGN_VARIANCE**: 8 (Asymmetric Bento, custom layout breaks, non-standard card placements)
- **MOTION_INTENSITY**: 6 (Perpetual spring micro-physics, staggered list reveals, smooth ticker scrolls, live tick flashing)
- **VISUAL_DENSITY**: 4 (High readability in portfolio views, packed mono density in OrderBook / Ticker)

## Colors
- **Base Background (#09090b):** Deep obsidian background for maximum focus and visual contrast.
- **Surface (#18181b):** Elevated card and panel surfaces with 1px liquid glass inner borders (`border-white/10`).
- **Gain / Emerald (#10b981):** Represents positive price movement, buy volume, and profit gains.
- **Loss / Rose (#f43f5e):** Represents negative price movement, sell volume, and portfolio loss.
- **Reference / Amber (#eab308):** Reference price (Giá tham chiếu).

## Typography
- **Headlines:** `Geist` or `Satoshi` with tight tracking (`tracking-tight`).
- **Data & Metrics:** `JetBrains Mono` for all price ticks, quantities, volume ratios, and timestamps.
- **Rule:** Banned font Inter. Banned Serif fonts on financial dashboards.

## Layout & Components
- **Bento 2.0 Grid:** Asymmetric grid structure separating top market tickers, order book depth, candlestick technical charts, and execution lists.
- **Tick Flashing:** Green/Red background highlight pulse when price ticks change.

## Do's and Don'ts
- **DO** use `JetBrains Mono` or tabular figures (`font-mono`) for all financial prices and volumes.
- **DO** extract high-frequency real-time tick elements into isolated `'use client'` leaf components.
- **DON'T** use purple gradients or neon button glows (Purple Ban enforced).
- **DON'T** use generic 3-column equal card rows. Use dynamic bento layouts.
