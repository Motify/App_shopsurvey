import { cn } from '@/lib/utils'
import Image from 'next/image'

interface LogoProps {
  className?: string
  iconOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'light' | 'dark'
}

export function Logo({ className, iconOnly = false, size = 'md', variant = 'dark' }: LogoProps) {
  const sizes = {
    sm: { width: 120, height: 40 },
    md: { width: 150, height: 50 },
    lg: { width: 200, height: 67 },
  }

  // For light variant (on green background), use CSS filter to make the logo white
  const filterClass = variant === 'light' ? 'brightness-0 invert' : ''

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/images/logo.png"
        alt="人事CREW"
        width={sizes[size].width}
        height={sizes[size].height}
        className={filterClass}
        priority
      />
    </div>
  )
}
