import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  iconOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'light' | 'dark'
}

export function Logo({ className, iconOnly = false, size = 'md', variant = 'dark' }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-6 w-6', text: 'text-base', crew: 'text-sm' },
    md: { icon: 'h-8 w-8', text: 'text-lg', crew: 'text-base' },
    lg: { icon: 'h-12 w-12', text: 'text-2xl', crew: 'text-xl' },
  }

  const textColor = variant === 'light' ? 'text-white' : 'text-slate-900'
  const crewColor = 'text-[#28cc8f]'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LogoIcon className={sizes[size].icon} />
      {!iconOnly && (
        <span className={cn('font-bold', sizes[size].text, textColor)}>
          人事<span className={cn(crewColor, sizes[size].crew, 'font-black')}>CREW</span>
        </span>
      )}
    </div>
  )
}

interface LogoIconProps {
  className?: string
}

export function LogoIcon({ className }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Left person */}
      <circle cx="8" cy="12" r="4" fill="#28cc8f" />
      <path
        d="M8 18c-4 0-6 3-6 6v8c0 1 0.5 2 2 2h8c1.5 0 2-1 2-2v-8c0-3-2-6-6-6z"
        fill="#28cc8f"
      />

      {/* Center person (taller/front) */}
      <circle cx="20" cy="8" r="5" fill="#28cc8f" />
      <path
        d="M20 15c-5 0-8 4-8 8v10c0 1.5 1 2.5 2.5 2.5h11c1.5 0 2.5-1 2.5-2.5v-10c0-4-3-8-8-8z"
        fill="#28cc8f"
      />

      {/* Right person */}
      <circle cx="32" cy="12" r="4" fill="#28cc8f" />
      <path
        d="M32 18c-4 0-6 3-6 6v8c0 1 0.5 2 2 2h8c1.5 0 2-1 2-2v-8c0-3-2-6-6-6z"
        fill="#28cc8f"
      />
    </svg>
  )
}
