import { CheckCircle2 } from 'lucide-react'

export default function ThanksPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-4">
      <div className="text-center max-w-sm">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            ご回答ありがとうございました
          </h1>
          <p className="text-slate-600">
            あなたの意見は職場改善に役立てられます
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 leading-relaxed">
            アンケートの回答は匿名で収集されています。
            <br />
            より良い職場環境づくりにご協力いただき、
            <br />
            誠にありがとうございます。
          </p>
        </div>

        <p className="text-xs text-slate-400 mt-6">
          このページは閉じても問題ありません
        </p>
      </div>
    </div>
  )
}
