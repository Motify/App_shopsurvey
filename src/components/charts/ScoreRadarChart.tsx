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
import { CATEGORY_LABELS, CategoryKey } from '@/lib/scoring'

interface CategoryScore {
  category: CategoryKey
  score: number | null
  benchmark: number | null
}

interface ScoreRadarChartProps {
  data: CategoryScore[]
  shopName?: string
  showBenchmark?: boolean
  height?: number
}

export function ScoreRadarChart({
  data,
  shopName = '店舗スコア',
  showBenchmark = true,
  height = 350,
}: ScoreRadarChartProps) {
  // Transform data for Recharts
  const chartData = data.map(item => ({
    category: CATEGORY_LABELS[item.category].ja,
    score: item.score ?? 0,
    benchmark: item.benchmark ?? 0,
    fullMark: 5,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 5]}
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          tickCount={6}
          axisLine={false}
        />
        <Radar
          name={shopName}
          dataKey="score"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        {showBenchmark && (
          <Radar
            name="業界平均"
            dataKey="benchmark"
            stroke="#94a3b8"
            fill="transparent"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        )}
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        />
        <Tooltip
          formatter={(value: number) => value.toFixed(2)}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// Multi-shop comparison radar chart
interface MultiShopRadarChartProps {
  shops: Array<{
    name: string
    data: CategoryScore[]
    color: string
  }>
  showBenchmark?: boolean
  benchmarkData?: CategoryScore[]
  height?: number
}

const SHOP_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
]

export function MultiShopRadarChart({
  shops,
  showBenchmark = true,
  benchmarkData,
  height = 400,
}: MultiShopRadarChartProps) {
  // Use first shop's categories as base
  if (shops.length === 0) return null

  const categories = shops[0].data.map(d => d.category)

  // Transform data for Recharts
  const chartData = categories.map((category, index) => {
    const item: Record<string, string | number> = {
      category: CATEGORY_LABELS[category].ja,
      fullMark: 5,
    }

    shops.forEach((shop, shopIndex) => {
      item[`shop${shopIndex}`] = shop.data[index]?.score ?? 0
    })

    if (showBenchmark && benchmarkData) {
      item.benchmark = benchmarkData[index]?.benchmark ?? 0
    }

    return item
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 5]}
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          tickCount={6}
          axisLine={false}
        />
        {shops.map((shop, index) => (
          <Radar
            key={shop.name}
            name={shop.name}
            dataKey={`shop${index}`}
            stroke={SHOP_COLORS[index % SHOP_COLORS.length]}
            fill={SHOP_COLORS[index % SHOP_COLORS.length]}
            fillOpacity={0.1}
            strokeWidth={2}
          />
        ))}
        {showBenchmark && benchmarkData && (
          <Radar
            name="業界平均"
            dataKey="benchmark"
            stroke="#94a3b8"
            fill="transparent"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        )}
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        />
        <Tooltip
          formatter={(value: number) => value.toFixed(2)}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
