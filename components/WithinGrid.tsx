'use client'

import { useRef, useState } from 'react'

/**
 * Within Grid — το daily check-in component (ενότητα 6.3 / 11 του brief).
 * 2 άξονες, tap οπουδήποτε -> συνεχείς συντεταγμένες (grid_x, grid_y) στο 0..1.
 *  X = Ενέργεια (χαμηλή 0 ↔ ψηλή 1)
 *  Y = Καθαρότητα (μπερδεμένη 0 ↔ καθαρή 1)   [πάνω = καθαρή]
 * Quadrants: aligned (x>=.5,y>=.5) · restorative (x<.5,y>=.5) ·
 *            reactive (x>=.5,y<.5) · depleted (x<.5,y<.5). Κανένα δεν είναι "λάθος".
 */

export type GridPoint = { x: number; y: number }

export function quadrantOf(x: number, y: number): 'aligned' | 'restorative' | 'reactive' | 'depleted' {
  if (x >= 0.5 && y >= 0.5) return 'aligned'
  if (x < 0.5 && y >= 0.5) return 'restorative'
  if (x >= 0.5 && y < 0.5) return 'reactive'
  return 'depleted'
}

const QUADRANT_LABEL: Record<string, string> = {
  aligned: 'Σήμερα ήσουν εσύ.',
  restorative: 'Ήσουν σε ειρήνη.',
  reactive: 'Ήσουν σε φόβο.',
  depleted: 'Ήσουν καμένος/η.',
}

type Props = {
  value?: GridPoint | null
  onChange?: (p: GridPoint) => void
  /** weekly view: σταθερά σημεία πάνω στο grid */
  dots?: GridPoint[]
  readOnly?: boolean
  showQuadrantLabel?: boolean
  size?: number
}

export default function WithinGrid({
  value = null,
  onChange,
  dots,
  readOnly = false,
  showQuadrantLabel = true,
  size = 300,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [point, setPoint] = useState<GridPoint | null>(value)

  function handleTap(e: React.MouseEvent | React.TouchEvent) {
    if (readOnly) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    let x = (clientX - rect.left) / rect.width
    let yTop = (clientY - rect.top) / rect.height
    x = Math.min(1, Math.max(0, x))
    // y: πάνω = καθαρή (1), κάτω = μπερδεμένη (0)
    const y = Math.min(1, Math.max(0, 1 - yTop))
    const p = { x, y }
    setPoint(p)
    onChange?.(p)
  }

  const q = point ? quadrantOf(point.x, point.y) : null

  return (
    <div className="within" style={{ width: size }}>
      {/* Y label (πάνω) */}
      <div style={{ color: 'var(--grey)', fontSize: 12, textAlign: 'center', marginBottom: 6 }}>
        καθαρή
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        {/* X label αριστερά (rotated) */}
        <div
          style={{
            color: 'var(--grey)', fontSize: 12, writingMode: 'vertical-rl',
            transform: 'rotate(180deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ενέργεια →
        </div>

        <div
          ref={ref}
          onMouseDown={handleTap}
          onTouchStart={handleTap}
          role="application"
          aria-label="Within Grid"
          style={{
            position: 'relative',
            width: size,
            height: size,
            border: '1px solid var(--ink)',
            background: 'var(--paper)',
            cursor: readOnly ? 'default' : 'crosshair',
            touchAction: 'none',
          }}
        >
          {/* μεσαίες γραμμές αξόνων */}
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#0000001a' }} />
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#0000001a' }} />

          {/* weekly dots */}
          {dots?.map((d, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `calc(${d.x * 100}% - 4px)`,
                top: `calc(${(1 - d.y) * 100}% - 4px)`,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--ink)', opacity: 0.5,
              }}
            />
          ))}

          {/* το σημερινό σημείο */}
          {point && (
            <span
              style={{
                position: 'absolute',
                left: `calc(${point.x * 100}% - 7px)`,
                top: `calc(${(1 - point.y) * 100}% - 7px)`,
                width: 14, height: 14, borderRadius: '50%',
                background: 'var(--gold)', boxShadow: '0 0 0 3px #C9A96133',
              }}
            />
          )}
        </div>
      </div>

      {/* Y label (κάτω) */}
      <div style={{ color: 'var(--grey)', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
        μπερδεμένη
      </div>

      {showQuadrantLabel && q && (
        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 18, color: 'var(--ink)' }} className="within-fade-in">
          {QUADRANT_LABEL[q]}
        </p>
      )}
    </div>
  )
}
