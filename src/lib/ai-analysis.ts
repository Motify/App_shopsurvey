import OpenAI from 'openai'

// Lazy initialize OpenAI client to avoid build-time errors
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

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
  positiveCount: number
  negativeCount: number
  neutralCount: number
  totalComments?: number
  sampledComments?: number
}

// Maximum number of comments to send to AI (to avoid token limits and timeouts)
const MAX_SAMPLE_SIZE = 75

// Fisher-Yates shuffle for random sampling
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export async function analyzeResponses(
  comments: string[]
): Promise<AnalysisResult> {
  const filteredComments = comments.filter(t => t?.trim())
  const totalComments = filteredComments.length

  // If no text responses, return empty analysis
  if (totalComments === 0) {
    return {
      positiveThemes: [],
      improvementThemes: [],
      summary: 'テキスト回答がありませんでした。',
      summaryEn: 'No text responses were provided.',
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      totalComments: 0,
      sampledComments: 0,
    }
  }

  // Sample comments if there are too many
  let commentsToAnalyze = filteredComments
  const isSampled = totalComments > MAX_SAMPLE_SIZE
  if (isSampled) {
    commentsToAnalyze = shuffleArray(filteredComments).slice(0, MAX_SAMPLE_SIZE)
  }

  const samplingNote = isSampled
    ? `\n\nNote: These are ${MAX_SAMPLE_SIZE} randomly sampled comments from a total of ${totalComments}. Scale your counts proportionally.`
    : ''

  const prompt = `You are analyzing employee survey comments for a shop/retail business in Japan.

## Employee Comments:
${commentsToAnalyze.map((t, i) => `${i + 1}. ${t}`).join('\n')}${samplingNote}

First, classify each comment as:
- POSITIVE: Expresses satisfaction, appreciation, or what they like about working here
- NEGATIVE/IMPROVEMENT: Expresses concerns, complaints, requests for change, or areas needing improvement
- NEUTRAL: Neither clearly positive nor negative, or just acknowledgments like "特にありません" (nothing in particular)

Then analyze and return a JSON object with:

1. "positiveThemes": Top 5 themes from POSITIVE comments (or fewer if not enough)
   - theme: Theme name in Japanese
   - themeEn: Theme name in English
   - count: How many comments mention this
   - percentage: Percentage of total positive comments (rounded to integer)
   - examples: 2-3 representative quotes (keep original Japanese)

2. "improvementThemes": Top 5 themes from NEGATIVE/IMPROVEMENT comments (or fewer if not enough)
   - theme: Theme name in Japanese
   - themeEn: Theme name in English
   - count: How many comments mention this
   - percentage: Percentage of total negative comments (rounded to integer)
   - examples: 2-3 representative quotes (keep original Japanese)
   - suggestedAction: One concrete action to address this (in Japanese)

3. "summary": 2-3 sentence summary in Japanese highlighting key findings
4. "summaryEn": Same summary in English
5. "positiveCount": Total number of comments classified as positive
6. "negativeCount": Total number of comments classified as negative/improvement
7. "neutralCount": Total number of comments classified as neutral

Focus on actionable, specific themes relevant to shop/retail work environments.
Group similar feedback together. Ignore very generic or unclear responses.
If a category has no comments, return an empty array for that category.

Return ONLY valid JSON, no other text or markdown formatting.`

  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
    temperature: 0.3,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  // Parse and validate the JSON response
  try {
    // Remove markdown code blocks if present
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()
    const result = JSON.parse(cleanedContent) as AnalysisResult

    // Ensure arrays exist
    result.positiveThemes = result.positiveThemes || []
    result.improvementThemes = result.improvementThemes || []
    result.summary = result.summary || ''
    result.summaryEn = result.summaryEn || ''
    result.positiveCount = result.positiveCount || 0
    result.negativeCount = result.negativeCount || 0
    result.neutralCount = result.neutralCount || 0
    result.totalComments = totalComments
    result.sampledComments = commentsToAnalyze.length

    return result
  } catch (parseError) {
    console.error('Failed to parse AI response:', content)
    throw new Error('Failed to parse AI analysis response')
  }
}
