import type { ComponentType } from 'react'

type CategoryIconProps = {
  categoryId: string
  size?: number
  className?: string
}

type IconComponent = ComponentType<{ size: number; className?: string }>

function SvgIcon({
  size,
  className,
  children,
}: {
  size: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

function LaptopIcon({ size, className }: { size: number; className?: string }) {
  return (
    <SvgIcon size={size} className={className}>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M2 18h20" />
    </SvgIcon>
  )
}

function BriefcaseIcon({ size, className }: { size: number; className?: string }) {
  return (
    <SvgIcon size={size} className={className}>
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <path d="M4 13h16" />
    </SvgIcon>
  )
}

function HeartIcon({ size, className }: { size: number; className?: string }) {
  return (
    <SvgIcon size={size} className={className}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </SvgIcon>
  )
}

function BookIcon({ size, className }: { size: number; className?: string }) {
  return (
    <SvgIcon size={size} className={className}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </SvgIcon>
  )
}

function MountainIcon({ size, className }: { size: number; className?: string }) {
  return (
    <SvgIcon size={size} className={className}>
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </SvgIcon>
  )
}

function DefaultIcon({ size, className }: { size: number; className?: string }) {
  return (
    <SvgIcon size={size} className={className}>
      <circle cx="12" cy="12" r="4" />
    </SvgIcon>
  )
}

const CATEGORY_ICON_MAP: Record<string, IconComponent> = {
  clarity: LaptopIcon,
  work: BriefcaseIcon,
  health: HeartIcon,
  learning: BookIcon,
}

export function CategoryIcon({ categoryId, size = 16, className }: CategoryIconProps) {
  const Icon = CATEGORY_ICON_MAP[categoryId] ?? DefaultIcon
  return <Icon size={size} className={className} />
}

export { LaptopIcon, BriefcaseIcon, HeartIcon, BookIcon, MountainIcon }
