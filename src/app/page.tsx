import Link from 'next/link'
import { Logo } from '@/components/ui/logo'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Logo size="lg" variant="dark" />
        </div>
        <p className="text-muted-foreground mb-8">
          従業員エンゲージメント調査システム
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          ログイン
        </Link>
      </div>
    </main>
  )
}
