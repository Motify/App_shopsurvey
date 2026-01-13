import { CheckCircle2 } from 'lucide-react'

export default function EmailSurveyThanksPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          ご協力ありがとうございました
        </h1>
        <p className="text-slate-600 mb-6">
          アンケートの回答が送信されました。<br />
          貴重なご意見をいただきありがとうございます。
        </p>
        <p className="text-sm text-slate-400">
          このページを閉じても大丈夫です。
        </p>
      </div>
    </div>
  )
}
