'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  order: number
  textJa: string
  textEn: string
  category: string
  isReversed: boolean
  isOutcome: boolean
  scale: string  // "1-5" or "0-10"
}

interface SurveyData {
  shop: {
    id: string
    name: string
    companyName: string
  }
  questions: Question[]
}

// Q1-Q10: 5-point scale (Q1-Q9 drivers + Q10 retention intention)
const SCALE_5_OPTIONS = [
  { value: 1, label: '全くそう思わない', labelEn: 'Strongly Disagree' },
  { value: 2, label: 'そう思わない', labelEn: 'Disagree' },
  { value: 3, label: 'どちらとも言えない', labelEn: 'Neutral' },
  { value: 4, label: 'そう思う', labelEn: 'Agree' },
  { value: 5, label: 'とてもそう思う', labelEn: 'Strongly Agree' },
]

// Q11: eNPS 0-10 scale
const NPS_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Helper to determine question type from the Question model
const getQuestionType = (question: Question): 'SCALE_5' | 'SCALE_11' | 'FREE_TEXT' => {
  if (question.scale === '0-10') return 'SCALE_11'
  return 'SCALE_5'
}

export default function SurveyPage({
  params,
}: {
  params: { qrCode: string }
}) {
  const { qrCode } = params
  const router = useRouter()

  const [surveyData, setSurveyData] = useState<SurveyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [enpsAnswer, setEnpsAnswer] = useState<number | null>(null)  // Q11 eNPS stored separately
  const [improvementText, setImprovementText] = useState('')  // Q12 free text
  const [submitting, setSubmitting] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [startTime] = useState(Date.now())

  // Identity escrow fields
  const [identity, setIdentity] = useState('')
  const [identityConsent, setIdentityConsent] = useState(false)

  useEffect(() => {
    fetchSurvey()
  }, [qrCode])

  const fetchSurvey = async () => {
    try {
      const response = await fetch(`/api/survey/${qrCode}`)
      const data = await response.json()

      if (!response.ok) {
        if (data.code === 'NOT_FOUND' || data.code === 'INACTIVE') {
          setError('このアンケートは無効です')
        } else {
          setError('エラーが発生しました')
        }
        return
      }

      setSurveyData(data)
    } catch (err) {
      console.error('Failed to fetch survey:', err)
      setError('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleEnpsChange = (value: number) => {
    setEnpsAnswer(value)
  }

  // Get required scale questions (Q1-Q10, all 1-5 scale)
  // Q11 (eNPS 0-10) is also required
  const getRequiredQuestions = () => {
    if (!surveyData) return []
    // All questions from the questions table are required (Q1-Q11)
    return surveyData.questions
  }

  // Check completion: all Q1-Q10 answered in answers + Q11 (eNPS) answered
  const isComplete = surveyData
    ? surveyData.questions.every((q) => {
        const questionType = getQuestionType(q)
        if (questionType === 'SCALE_11') {
          return enpsAnswer !== null
        }
        return answers[q.id] !== undefined
      })
    : false

  const getUnansweredQuestions = () => {
    if (!surveyData) return []
    return surveyData.questions.filter((q) => {
      const questionType = getQuestionType(q)
      if (questionType === 'SCALE_11') {
        return enpsAnswer === null
      }
      return answers[q.id] === undefined
    })
  }

  const handleSubmit = async () => {
    if (!surveyData) return

    if (!isComplete) {
      setShowValidation(true)
      // Scroll to first unanswered question
      const unanswered = getUnansweredQuestions()
      if (unanswered.length > 0) {
        const element = document.getElementById(`question-${unanswered[0].id}`)
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setSubmitting(true)

    try {
      // Convert answers to q1, q2, ... format (Q1-Q10 are 1-5 scale)
      const formattedAnswers: Record<string, number> = {}
      surveyData.questions.forEach((q) => {
        const questionType = getQuestionType(q)
        // Only include 1-5 scale questions in answers (not Q11 eNPS)
        if (questionType === 'SCALE_5' && answers[q.id] !== undefined) {
          formattedAnswers[`q${q.order}`] = answers[q.id]
        }
      })

      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: surveyData.shop.id,
          answers: formattedAnswers,           // Q1-Q10 (1-5 scale)
          enpsScore: enpsAnswer,               // Q11 (0-10 scale) stored separately
          improvementText: improvementText.trim() || null,  // Q12 free text
          timeSpentSeconds: Math.round((Date.now() - startTime) / 1000),
          // Identity escrow fields
          identity: identityConsent && identity.trim() ? identity.trim() : null,
          identityConsent,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit')
      }

      router.push(`/survey/${qrCode}/thanks`)
    } catch (err) {
      console.error('Failed to submit survey:', err)
      setError('送信に失敗しました。もう一度お試しください。')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">{error}</h1>
          <p className="text-slate-500 text-sm">
            QRコードを再度スキャンするか、管理者にお問い合わせください
          </p>
        </div>
      </div>
    )
  }

  if (!surveyData) return null

  const requiredQuestions = getRequiredQuestions()
  // Count answered: scale_5 questions from answers + eNPS
  const answeredCount = requiredQuestions.filter((q) => {
    const questionType = getQuestionType(q)
    if (questionType === 'SCALE_11') {
      return enpsAnswer !== null
    }
    return answers[q.id] !== undefined
  }).length
  const totalRequired = requiredQuestions.length
  const progressPercent = (answeredCount / totalRequired) * 100

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="text-center mb-2">
            <h1 className="text-lg font-bold text-slate-900">
              従業員満足度アンケート
            </h1>
            <p className="text-xs text-slate-500">{surveyData.shop.name}</p>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 text-center mt-1">
            {answeredCount} / {totalRequired} 回答済み
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {surveyData.questions.map((question, index) => {
          const questionType = getQuestionType(question)
          const isAnswered = questionType === 'SCALE_11'
            ? enpsAnswer !== null
            : answers[question.id] !== undefined
          const isUnanswered = showValidation && !isAnswered

          return (
            <div
              key={question.id}
              id={`question-${question.id}`}
              className={cn(
                'bg-white rounded-xl p-4 shadow-sm border transition-all',
                isUnanswered && 'border-red-300 ring-2 ring-red-100',
                isAnswered && 'border-emerald-200'
              )}
            >
              <div className="flex items-start gap-3 mb-4">
                <span
                  className={cn(
                    'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
                    isAnswered
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {isAnswered ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="flex-1">
                  <p className="text-slate-900 font-medium leading-relaxed">
                    {question.textJa}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {question.textEn}
                  </p>
                </div>
              </div>

              {/* Q1-Q10: 5-point scale */}
              {questionType === 'SCALE_5' && (
                <>
                  <div className="grid grid-cols-5 gap-1">
                    {SCALE_5_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleAnswerChange(question.id, option.value)}
                        className={cn(
                          'flex flex-col items-center p-2 rounded-lg border-2 transition-all',
                          answers[question.id] === option.value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                        )}
                      >
                        <span className="text-lg font-bold">{option.value}</span>
                        <span className="text-[10px] leading-tight text-center mt-1 hidden sm:block">
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 sm:hidden">
                    <span>全くそう思わない</span>
                    <span>とてもそう思う</span>
                  </div>
                </>
              )}

              {/* Q11: eNPS 0-10 scale */}
              {questionType === 'SCALE_11' && (
                <>
                  <div className="grid grid-cols-11 gap-1">
                    {NPS_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleEnpsChange(value)}
                        className={cn(
                          'flex flex-col items-center py-3 px-1 rounded-lg border-2 transition-all',
                          enpsAnswer === value
                            ? value >= 9
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : value >= 7
                              ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                              : 'border-red-500 bg-red-50 text-red-700'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                        )}
                      >
                        <span className="text-sm font-bold">{value}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2">
                    <span className="text-red-500">勧めない</span>
                    <span className="text-emerald-500">強く勧める</span>
                  </div>
                  <div className="flex justify-center gap-4 mt-2 text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      批判者 (0-6)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      中立者 (7-8)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      推奨者 (9-10)
                    </span>
                  </div>
                </>
              )}

              {isUnanswered && (
                <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  この質問に回答してください
                </p>
              )}
            </div>
          )
        })}

        {/* Q12: Free text improvement suggestions (optional) */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-start gap-3 mb-4">
            <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold bg-slate-100 text-slate-500">
              12
            </span>
            <div className="flex-1">
              <p className="text-slate-900 font-medium leading-relaxed">
                職場環境の改善について、ご意見やご要望がありましたらお聞かせください
                <span className="text-slate-400 text-sm ml-2">（任意）</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Please share any feedback or suggestions for workplace improvement (optional)
              </p>
            </div>
          </div>
          <textarea
            value={improvementText}
            onChange={(e) => setImprovementText(e.target.value)}
            placeholder="改善してほしいこと、良かった点などをお聞かせください..."
            className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            rows={4}
          />
        </div>

        {/* Identity Escrow Section */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <h3 className="font-medium text-slate-900 mb-3">
            【任意】連絡先の入力
          </h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={identityConsent}
              onChange={(e) => {
                setIdentityConsent(e.target.checked)
                if (!e.target.checked) setIdentity('')
              }}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-600 leading-relaxed">
              この情報は通常、会社に開示されません。
              ハラスメントや安全に関わる深刻な報告があった場合のみ、
              第三者機関の判断により本人確認に使用される可能性があります。
            </span>
          </label>

          {identityConsent && (
            <input
              type="text"
              placeholder="メールアドレスまたは社員番号"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              className="w-full mt-3 p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          )}
        </div>

        {/* Submit button */}
        <div className="pt-4 pb-8">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={cn(
              'w-full py-4 rounded-xl font-bold text-lg transition-all',
              isComplete
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg'
                : 'bg-slate-200 text-slate-500'
            )}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                送信中...
              </span>
            ) : (
              '回答を送信する'
            )}
          </button>

          {showValidation && !isComplete && (
            <p className="text-red-500 text-sm text-center mt-3">
              すべての質問に回答してください（残り {totalRequired - answeredCount} 問）
            </p>
          )}

          <p className="text-xs text-slate-400 text-center mt-4">
            回答は匿名で収集され、職場改善のために利用されます
          </p>
        </div>
      </div>
    </div>
  )
}
