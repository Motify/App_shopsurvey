'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { CategoryKey, CATEGORY_LABELS } from '@/lib/scoring'

interface TrendDataPoint {
  month: string
  responseCount: number
  overallScore: number | null
  categoryScores: Record<CategoryKey, number | null> | null
  enps: number | null
}

interface TrendLineChartProps {
  data: TrendDataPoint[]
  showCategories?: boolean
  selectedCategories?: CategoryKey[]
  height?: number
}

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  MANAGER_LEADERSHIP: '#3b82f6',
  SCHEDULE_HOURS: '#10b981',
  TEAMWORK: '#f59e0b',
  WORKLOAD_STAFFING: '#ef4444',
  RESPECT_RECOGNITION: '#8b5cf6',
  PAY_BENEFITS: '#ec4899',
  WORK_ENVIRONMENT: '#06b6d4',
  RETENTION_INTENT: '#84cc16',
}

export function TrendLineChart({
  data,
  showCategories = false,
  selectedCategories = [],
  height = 300,
}: TrendLineChartProps) {
  // Format month for display
  const formatMonth = (month: string) => {
    const [year, m] = month.split('-')
    return `${m}月`
  }

  // Transform data for chart
  const chartData = data.map(point => {
    const item: Record<string, string | number | null> = {
      month: formatMonth(point.month),
      fullMonth: point.month,
      overall: point.overallScore,
      responses: point.responseCount,
    }

    if (showCategories && point.categoryScores) {
      for (const category of Object.keys(point.categoryScores) as CategoryKey[]) {
        item[category] = point.categoryScores[category]
      }
    }

    return item
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="month"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          domain={[1, 5]}
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          tickCount={5}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value, name) => {
            if (value === null || value === undefined) return ['-', name]
            if (name === 'responses') return [value, '回答数']
            const numValue = typeof value === 'number' ? value : parseFloat(String(value))
            return [numValue.toFixed(2), name === 'overall' ? '総合スコア' : CATEGORY_LABELS[name as CategoryKey]?.ja || name]
          }}
          labelFormatter={(label, payload) => {
            const item = payload?.[0]?.payload
            return `${item?.fullMonth || label} (${item?.responses || 0}件)`
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
          formatter={(value) => {
            if (value === 'overall') return '総合スコア'
            return CATEGORY_LABELS[value as CategoryKey]?.ja || value
          }}
        />
        <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="5 5" />

        {/* Overall score line */}
        <Line
          type="monotone"
          dataKey="overall"
          name="overall"
          stroke="#000000"
          strokeWidth={2}
          dot={{ fill: '#000000', r: 4 }}
          activeDot={{ r: 6 }}
          connectNulls
        />

        {/* Category lines */}
        {showCategories &&
          selectedCategories.map(category => (
            <Line
              key={category}
              type="monotone"
              dataKey={category}
              name={category}
              stroke={CATEGORY_COLORS[category]}
              strokeWidth={1.5}
              dot={{ fill: CATEGORY_COLORS[category], r: 3 }}
              connectNulls
            />
          ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// eNPS trend chart
interface ENPSTrendChartProps {
  data: TrendDataPoint[]
  height?: number
}

export function ENPSTrendChart({ data, height = 250 }: ENPSTrendChartProps) {
  const formatMonth = (month: string) => {
    const [year, m] = month.split('-')
    return `${m}月`
  }

  const chartData = data.map(point => ({
    month: formatMonth(point.month),
    fullMonth: point.month,
    enps: point.enps,
    responses: point.responseCount,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="month"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          domain={[-100, 100]}
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          tickCount={5}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value) => {
            if (value === null || value === undefined) return ['-', 'eNPS']
            const numValue = typeof value === 'number' ? value : parseInt(String(value), 10)
            return [numValue >= 0 ? `+${numValue}` : numValue, 'eNPS']
          }}
          labelFormatter={(label, payload) => {
            const item = payload?.[0]?.payload
            return `${item?.fullMonth || label} (${item?.responses || 0}件)`
          }}
        />
        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="5 5" />
        <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
        <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
        <Line
          type="monotone"
          dataKey="enps"
          name="eNPS"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
