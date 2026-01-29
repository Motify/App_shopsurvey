// 8 Driver Dimensions to question mapping (Q1-Q9)
// These are the factors that drive employee retention
// Q10 (Retention Intention) and Q11 (eNPS) are outcome measures, not included here
export const CATEGORY_MAPPING = {
  MANAGER_LEADERSHIP: ['q1', 'q2'],     // 店長・リーダー (Q1, Q2)
  SCHEDULE_HOURS: ['q3'],               // シフト・時間 (Q3)
  TEAMWORK: ['q4'],                     // チームワーク (Q4)
  WORKLOAD_STAFFING: ['q5'],            // 人員・体制 (Q5 - reverse scored)
  RESPECT_RECOGNITION: ['q6'],          // 尊重・承認 (Q6)
  PAY_BENEFITS: ['q7'],                 // 給与・待遇 (Q7)
  WORK_ENVIRONMENT: ['q8'],             // 職場環境 (Q8)
  SKILLS_GROWTH: ['q9'],                // スキル・成長 (Q9)
} as const

// Categories that are reverse scored (high score = bad)
// Q5 (WORKLOAD_STAFFING): "人手が足りないと感じることはありますか？"
// Higher score = more shortage = worse, so it needs to be inverted for overall scoring
export const REVERSE_SCORED_CATEGORIES: readonly string[] = ['WORKLOAD_STAFFING'] as const

export type CategoryKey = keyof typeof CATEGORY_MAPPING

// Japanese labels for the 8 driver dimensions
export const CATEGORY_LABELS: Record<CategoryKey, { ja: string; en: string }> = {
  MANAGER_LEADERSHIP: { ja: '店長・リーダー', en: 'Manager & Leadership' },
  SCHEDULE_HOURS: { ja: 'シフト・時間', en: 'Schedule & Hours' },
  TEAMWORK: { ja: 'チームワーク', en: 'Teamwork' },
  WORKLOAD_STAFFING: { ja: '人員・体制', en: 'Staffing & Resources' },
  RESPECT_RECOGNITION: { ja: '尊重・承認', en: 'Respect & Recognition' },
  PAY_BENEFITS: { ja: '給与・待遇', en: 'Pay & Benefits' },
  WORK_ENVIRONMENT: { ja: '職場環境', en: 'Work Environment' },
  SKILLS_GROWTH: { ja: 'スキル・成長', en: 'Skills & Growth' },
}

// Risk level types
export type OverallRiskLevel = 'CRITICAL' | 'WARNING' | 'CAUTION' | 'STABLE' | 'EXCELLENT'
export type CategoryRiskLevel = 'NEEDS_IMPROVEMENT' | 'ROOM_FOR_IMPROVEMENT' | 'GOOD'

export interface RiskInfo {
  level: string
  label: string
  color: string
}

// Overall risk level thresholds (Japan-adjusted)
export function getOverallRiskLevel(score: number): RiskInfo {
  if (score <= 2.0) return { level: 'CRITICAL', label: '危険', color: 'red' }
  if (score <= 2.7) return { level: 'WARNING', label: '注意', color: 'orange' }
  if (score <= 3.2) return { level: 'CAUTION', label: 'やや注意', color: 'yellow' }
  if (score <= 3.8) return { level: 'STABLE', label: '安定', color: 'green' }
  return { level: 'EXCELLENT', label: '優良', color: 'emerald' }
}

// Category risk level thresholds
export function getCategoryRiskLevel(score: number, isReverse = false): RiskInfo {
  // For reverse-scored categories (like WORKLOAD_STAFFING), lower score = better
  if (isReverse) {
    // Invert the score for risk calculation: high original score = high risk
    if (score >= 4.0) return { level: 'NEEDS_IMPROVEMENT', label: '要改善', color: 'red' }
    if (score >= 3.2) return { level: 'ROOM_FOR_IMPROVEMENT', label: '改善余地あり', color: 'yellow' }
    return { level: 'GOOD', label: '良好', color: 'green' }
  }

  // Normal scoring: higher score = better
  if (score <= 2.5) return { level: 'NEEDS_IMPROVEMENT', label: '要改善', color: 'red' }
  if (score <= 3.2) return { level: 'ROOM_FOR_IMPROVEMENT', label: '改善余地あり', color: 'yellow' }
  return { level: 'GOOD', label: '良好', color: 'green' }
}

// Response answer type for the JSON answers field
// Q1-Q9: 8 driver dimensions (1-5 scale)
// Q10: Retention intention outcome (1-5 scale)
// Note: eNPS (Q11) is stored separately in Response.enpsScore (0-10 scale)
export interface ResponseAnswers {
  q1?: number   // 1-5 Manager Leadership
  q2?: number   // 1-5 Manager Leadership
  q3?: number   // 1-5 Schedule/Hours
  q4?: number   // 1-5 Teamwork
  q5?: number   // 1-5 Workload/Staffing (reverse scored)
  q6?: number   // 1-5 Respect/Recognition
  q7?: number   // 1-5 Pay/Benefits
  q8?: number   // 1-5 Work Environment
  q9?: number   // 1-5 Skills/Growth
  q10?: number  // 1-5 Retention Intention (outcome measure)
  [key: string]: number | undefined
}

// Extended response type that includes enpsScore from the Response model
export interface ResponseWithENPS {
  answers: ResponseAnswers
  enpsScore?: number | null  // 0-10 eNPS score (Q11)
}

// Calculate category score from multiple responses
// Returns the raw average (not inverted for reverse-scored)
export function calculateCategoryScore(
  responses: ResponseAnswers[],
  category: CategoryKey
): number | null {
  if (responses.length === 0) return null

  const questions = CATEGORY_MAPPING[category]
  let total = 0
  let count = 0

  for (const response of responses) {
    for (const q of questions) {
      const value = response[q]
      if (typeof value === 'number' && value >= 1 && value <= 5) {
        total += value
        count++
      }
    }
  }

  return count > 0 ? total / count : null
}

// Calculate all category scores
export function calculateAllCategoryScores(
  responses: ResponseAnswers[]
): Record<CategoryKey, number | null> {
  const categories = Object.keys(CATEGORY_MAPPING) as CategoryKey[]
  const scores: Record<CategoryKey, number | null> = {} as Record<CategoryKey, number | null>

  for (const category of categories) {
    scores[category] = calculateCategoryScore(responses, category)
  }

  return scores
}

// Calculate overall score (average of Q1-Q9)
export function calculateOverallScore(responses: ResponseAnswers[]): number | null {
  if (responses.length === 0) return null

  let total = 0
  let count = 0

  for (const response of responses) {
    for (let i = 1; i <= 9; i++) {
      const value = response[`q${i}`]
      if (typeof value === 'number' && value >= 1 && value <= 5) {
        total += value
        count++
      }
    }
  }

  return count > 0 ? total / count : null
}

// Format score for display
export function formatScore(score: number | null): string {
  if (score === null) return '-'
  return score.toFixed(2)
}

// Get confidence level based on response count
export function getConfidenceLevel(responseCount: number): {
  level: 'LOW' | 'MEDIUM' | 'HIGH'
  label: string
  description: string
} {
  if (responseCount < 5) {
    return {
      level: 'LOW',
      label: '参考値',
      description: '回答数が少ないため参考値です',
    }
  }
  if (responseCount < 20) {
    return {
      level: 'MEDIUM',
      label: '中程度',
      description: '回答数が増えるとより正確な結果が得られます',
    }
  }
  return {
    level: 'HIGH',
    label: '高信頼度',
    description: '十分な回答数があります',
  }
}

// Calculate difference from benchmark
export function calculateBenchmarkDifference(
  score: number | null,
  benchmark: number | null,
  isReverse = false
): { difference: number | null; label: string; isPositive: boolean | null } {
  if (score === null || benchmark === null) {
    return { difference: null, label: '-', isPositive: null }
  }

  const diff = score - benchmark

  // For reverse-scored categories, lower score is better
  // So negative difference (score < benchmark) is positive
  const isPositive = isReverse ? diff <= 0 : diff >= 0

  const label = isReverse
    ? (diff <= 0
      ? `業界平均より ${Math.abs(diff).toFixed(1)} ポイント良い`
      : `業界平均より ${Math.abs(diff).toFixed(1)} ポイント悪い`)
    : (diff >= 0
      ? `業界平均より ${Math.abs(diff).toFixed(1)} ポイント高い`
      : `業界平均より ${Math.abs(diff).toFixed(1)} ポイント低い`)

  return { difference: diff, label, isPositive }
}

// ============================================
// eNPS (Employee Net Promoter Score) Functions
// ============================================

export interface ENPSResult {
  score: number | null
  promoters: number       // Count of 9-10
  passives: number        // Count of 7-8
  detractors: number      // Count of 0-6
  totalResponses: number
  promoterPercentage: number | null
  detractorPercentage: number | null
}

// Calculate eNPS from responses
// eNPS = % Promoters - % Detractors (range: -100 to +100)
// Now uses enpsScore field (Q11) instead of q10 in answers
export function calculateENPS(responses: ResponseWithENPS[]): ENPSResult {
  let promoters = 0
  let passives = 0
  let detractors = 0
  let totalWithENPS = 0

  for (const response of responses) {
    const enpsValue = response.enpsScore
    if (typeof enpsValue === 'number' && enpsValue >= 0 && enpsValue <= 10) {
      totalWithENPS++
      if (enpsValue >= 9) {
        promoters++
      } else if (enpsValue >= 7) {
        passives++
      } else {
        detractors++
      }
    }
  }

  if (totalWithENPS === 0) {
    return {
      score: null,
      promoters: 0,
      passives: 0,
      detractors: 0,
      totalResponses: 0,
      promoterPercentage: null,
      detractorPercentage: null,
    }
  }

  const promoterPercentage = (promoters / totalWithENPS) * 100
  const detractorPercentage = (detractors / totalWithENPS) * 100
  const score = promoterPercentage - detractorPercentage

  return {
    score: Math.round(score),
    promoters,
    passives,
    detractors,
    totalResponses: totalWithENPS,
    promoterPercentage,
    detractorPercentage,
  }
}

// Calculate eNPS from array of enpsScore values (simpler version)
export function calculateENPSFromScores(enpsScores: (number | null | undefined)[]): ENPSResult {
  let promoters = 0
  let passives = 0
  let detractors = 0
  let totalWithENPS = 0

  for (const score of enpsScores) {
    if (typeof score === 'number' && score >= 0 && score <= 10) {
      totalWithENPS++
      if (score >= 9) {
        promoters++
      } else if (score >= 7) {
        passives++
      } else {
        detractors++
      }
    }
  }

  if (totalWithENPS === 0) {
    return {
      score: null,
      promoters: 0,
      passives: 0,
      detractors: 0,
      totalResponses: 0,
      promoterPercentage: null,
      detractorPercentage: null,
    }
  }

  const promoterPercentage = (promoters / totalWithENPS) * 100
  const detractorPercentage = (detractors / totalWithENPS) * 100
  const enpsScore = promoterPercentage - detractorPercentage

  return {
    score: Math.round(enpsScore),
    promoters,
    passives,
    detractors,
    totalResponses: totalWithENPS,
    promoterPercentage,
    detractorPercentage,
  }
}

// Get eNPS risk level
export function getENPSRiskLevel(score: number | null): RiskInfo {
  if (score === null) return { level: 'NO_DATA', label: 'データなし', color: 'slate' }
  if (score <= -30) return { level: 'CRITICAL', label: '危険', color: 'red' }
  if (score <= 0) return { level: 'WARNING', label: '注意', color: 'orange' }
  if (score <= 30) return { level: 'STABLE', label: '安定', color: 'green' }
  return { level: 'EXCELLENT', label: '優良', color: 'emerald' }
}

// Format eNPS score for display
export function formatENPS(score: number | null): string {
  if (score === null) return '-'
  return score >= 0 ? `+${score}` : `${score}`
}

// ============================================
// Retention Intention (Q10) Outcome Functions
// ============================================

// Calculate average retention intention score from Q10 (1-5 scale)
export function calculateRetentionIntention(responses: ResponseAnswers[]): number | null {
  if (responses.length === 0) return null

  let total = 0
  let count = 0

  for (const response of responses) {
    const q10 = response.q10
    if (typeof q10 === 'number' && q10 >= 1 && q10 <= 5) {
      total += q10
      count++
    }
  }

  return count > 0 ? total / count : null
}

// Get retention intention risk level
export function getRetentionIntentionRiskLevel(score: number | null): RiskInfo {
  if (score === null) return { level: 'NO_DATA', label: 'データなし', color: 'slate' }
  if (score <= 2.0) return { level: 'CRITICAL', label: '危険', color: 'red' }
  if (score <= 2.7) return { level: 'WARNING', label: '注意', color: 'orange' }
  if (score <= 3.2) return { level: 'CAUTION', label: 'やや注意', color: 'yellow' }
  if (score <= 3.8) return { level: 'STABLE', label: '安定', color: 'green' }
  return { level: 'EXCELLENT', label: '優良', color: 'emerald' }
}
