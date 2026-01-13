import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ThemeResult {
  theme: string
  themeEn: string
  count: number
  percentage: number
  examples: string[]
}

export interface ImprovementTheme extends ThemeResult {
  suggestedAction: string
}

export interface AnalysisResult {
  positiveThemes: ThemeResult[]
  improvementThemes: ImprovementTheme[]
  summary: string
  summaryEn: string
}

export async function analyzeResponses(
  positiveTexts: string[],
  improvementTexts: string[]
): Promise<AnalysisResult> {
  const filteredPositive = positiveTexts.filter(t => t?.trim())
  const filteredImprovement = improvementTexts.filter(t => t?.trim())

  // If no text responses, return empty analysis
  if (filteredPositive.length === 0 && filteredImprovement.length === 0) {
    return {
      positiveThemes: [],
      improvementThemes: [],
      summary: 'テキスト回答がありませんでした。',
      summaryEn: 'No text responses were provided.',
    }
  }

  const prompt = `You are analyzing employee survey responses for a shop/retail business in Japan.

## Positive Feedback (働き続けたい理由):
${filteredPositive.length > 0 ? filteredPositive.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(No responses)'}

## Improvement Requests (改善してほしいこと):
${filteredImprovement.length > 0 ? filteredImprovement.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(No responses)'}

Analyze these responses and return a JSON object with:

1. "positiveThemes": Top 5 themes from positive feedback (or fewer if not enough responses)
   - theme: Theme name in Japanese
   - themeEn: Theme name in English
   - count: How many responses mention this
   - percentage: Percentage of total positive responses (rounded to integer)
   - examples: 2-3 representative quotes (anonymized, keep original Japanese)

2. "improvementThemes": Top 5 themes from improvement requests (or fewer if not enough responses)
   - theme: Theme name in Japanese
   - themeEn: Theme name in English
   - count: How many responses mention this
   - percentage: Percentage of total improvement responses (rounded to integer)
   - examples: 2-3 representative quotes (anonymized, keep original Japanese)
   - suggestedAction: One concrete action to address this (in Japanese)

3. "summary": 2-3 sentence summary in Japanese highlighting key findings
4. "summaryEn": Same summary in English

Focus on actionable, specific themes relevant to shop/retail work environments.
Group similar feedback together. Ignore very generic or unclear responses.
If a category has no responses, return an empty array for that category.

Return ONLY valid JSON, no other text or markdown formatting.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI')
  }

  // Parse and validate the JSON response
  try {
    const result = JSON.parse(content.text) as AnalysisResult

    // Ensure arrays exist
    result.positiveThemes = result.positiveThemes || []
    result.improvementThemes = result.improvementThemes || []
    result.summary = result.summary || ''
    result.summaryEn = result.summaryEn || ''

    return result
  } catch (parseError) {
    console.error('Failed to parse AI response:', content.text)
    throw new Error('Failed to parse AI analysis response')
  }
}
