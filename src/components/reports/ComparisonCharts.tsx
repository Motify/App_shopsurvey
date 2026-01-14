'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface ShopReport {
  shop: {
    id: string
    name: string
  }
  scores: {
    overall: number | null
    categories: Record<string, number | null>
  }
  responseCount: number
}

interface ComparisonRadarChartProps {
  shops: ShopReport[]
  benchmark: Record<string, number>
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

const CATEGORY_LABELS: Record<string, string> = {
  MANAGER_LEADERSHIP: '店長・リーダー',
  SCHEDULE_HOURS: 'シフト・時間',
  TEAMWORK: 'チームワーク',
  WORKLOAD_STAFFING: '忙しさ・負担',
  RESPECT_RECOGNITION: '尊重・承認',
  PAY_BENEFITS: '給与・待遇',
  WORK_ENVIRONMENT: '職場環境',
  RETENTION_INTENT: '定着意向',
}

export function ComparisonRadarChart({ shops, benchmark }: ComparisonRadarChartProps) {
  // Build chart data
  const chartData = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const dataPoint: Record<string, string | number | null> = {
      category: label,
      benchmark: benchmark[key] ?? null,
    }

    shops.forEach((shop) => {
      dataPoint[shop.shop.id] = shop.scores.categories[key] ?? null
    })

    return dataPoint
  })

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fontSize: 11, fill: '#64748b' }}
        />
        <PolarRadiusAxis
          domain={[1, 5]}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickCount={5}
        />

        {/* Benchmark line (dashed) */}
        <Radar
          name="業界平均"
          dataKey="benchmark"
          stroke="#9CA3AF"
          strokeWidth={2}
          strokeDasharray="5 5"
          fill="none"
        />

        {/* Each shop */}
        {shops.map((shop, i) => (
          <Radar
            key={shop.shop.id}
            name={shop.shop.name}
            dataKey={shop.shop.id}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            fillOpacity={0.1}
          />
        ))}

        <Legend
          wrapperStyle={{ paddingTop: 20 }}
        />
        <Tooltip
          formatter={(value: number) => value?.toFixed(2) ?? '-'}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
