import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type DockItem = {
  icon: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
}

type DockProps = {
  items: DockItem[]
  panelHeight?: number
  baseItemSize?: number
  magnification?: number
  className?: string
}

export default function Dock({
  items,
  panelHeight = 68,
  baseItemSize = 50,
  magnification = 70,
  className,
}: DockProps) {
  const hoverScale = Math.max(magnification / baseItemSize, 1)

  return (
    <nav className={cn('dock-shell', className)} aria-label="Primary navigation">
      <div
        className="dock-panel"
        style={{
          '--dock-panel-height': `${panelHeight}px`,
          '--dock-base-size': `${baseItemSize}px`,
          '--dock-hover-scale': hoverScale.toString(),
        } as React.CSSProperties}
      >
        {items.map((item, index) => (
          <motion.button
            key={item.label}
            type="button"
            className="dock-item"
            onClick={item.onClick}
            disabled={item.disabled}
            data-active={item.active}
            data-disabled={item.disabled}
            aria-current={item.active ? 'page' : undefined}
            title={item.label}
            onMouseLeave={() => undefined}
            whileHover={item.disabled ? undefined : { scale: hoverScale, y: -6 }}
            whileTap={item.disabled ? undefined : { scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            initial={false}
            animate={{
              scale: item.active ? 1.06 : 1,
            }}
          >
            <span className="dock-icon">{item.icon}</span>
            <span className="dock-label">{item.label}</span>
            <span className="dock-sheen" />
          </motion.button>
        ))}
      </div>
    </nav>
  )
}