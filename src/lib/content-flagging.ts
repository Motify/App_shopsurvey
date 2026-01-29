/**
 * Content flagging utility for detecting concerning content in survey responses
 * Used for identity escrow system to flag responses that may require follow-up
 */

const ALERT_KEYWORDS = {
  harassment: {
    ja: ['セクハラ', 'パワハラ', 'いじめ', '触られた', '嫌がらせ', 'ハラスメント', 'モラハラ', '性的', 'わいせつ'],
    en: ['harassment', 'bullying', 'touched', 'groped', 'inappropriate', 'sexual', 'molest'],
  },
  safety: {
    ja: ['暴力', '殴られた', '蹴られた', '脅された', '怖い', '危険', '怪我', '事故', '違法'],
    en: ['violence', 'hit', 'kicked', 'threatened', 'scared', 'unsafe', 'injury', 'accident', 'illegal'],
  },
  crisis: {
    ja: ['死にたい', '自殺', '限界', 'うつ', '消えたい', '辛い', '眠れない', 'パニック'],
    en: ['suicide', 'kill myself', 'end it', 'die', 'depression', 'panic', 'breakdown'],
  },
  discrimination: {
    ja: ['差別', '人種', '国籍', '障害', '宗教', '偏見'],
    en: ['discrimination', 'racist', 'xenophob', 'disability', 'prejudice', 'bias'],
  },
} as const

export type FlagCategory = keyof typeof ALERT_KEYWORDS

export interface FlagResult {
  flagged: boolean
  reasons: FlagCategory[]
}

/**
 * Checks text content for concerning keywords that may require follow-up
 * @param text The text to analyze
 * @returns Object with flagged status and array of flag categories
 */
export function checkForConcerningContent(text: string | null | undefined): FlagResult {
  if (!text) return { flagged: false, reasons: [] }

  const lowerText = text.toLowerCase()
  const reasons: FlagCategory[] = []

  for (const [category, keywords] of Object.entries(ALERT_KEYWORDS)) {
    const allKeywords = [...keywords.ja, ...keywords.en]
    for (const keyword of allKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        reasons.push(category as FlagCategory)
        break // One match per category is enough
      }
    }
  }

  return {
    flagged: reasons.length > 0,
    reasons: Array.from(new Set(reasons)), // Remove duplicates
  }
}

/**
 * Combines flag results from multiple text fields
 * @param texts Array of text content to check
 * @returns Combined flag result
 */
export function checkMultipleTexts(texts: (string | null | undefined)[]): FlagResult {
  const allReasons: FlagCategory[] = []

  for (const text of texts) {
    const result = checkForConcerningContent(text)
    allReasons.push(...result.reasons)
  }

  const uniqueReasons = Array.from(new Set(allReasons))

  return {
    flagged: uniqueReasons.length > 0,
    reasons: uniqueReasons,
  }
}

/**
 * Gets Japanese label for a flag category
 */
export function getFlagCategoryLabel(category: FlagCategory): string {
  const labels: Record<FlagCategory, string> = {
    harassment: 'ハラスメント',
    safety: '安全性',
    crisis: 'メンタルヘルス',
    discrimination: '差別',
  }
  return labels[category]
}
