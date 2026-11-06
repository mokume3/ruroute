import { readFileSync, writeFileSync } from 'node:fs'

interface CoverageMetric {
  pct: number
}

interface CoverageSummary {
  total: Record<'lines' | 'statements' | 'functions' | 'branches', CoverageMetric>
}

const SUMMARY_PATH = 'coverage/coverage-summary.json'
const BADGE_PATH = 'coverage/badge.svg'
const LABEL = 'coverage'
const CHAR_WIDTH = 7
const TEXT_PADDING = 10
const COLOR_THRESHOLDS: [number, string][] = [
  [100, '#4c1'],
  [90, '#97ca00'],
  [80, '#dfb317'],
  [60, '#fe7d37'],
]
const LOW_COVERAGE_COLOR = '#e05d44'

const summary: CoverageSummary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'))
const { lines, statements, functions, branches } = summary.total
const percentage = Math.min(lines.pct, statements.pct, functions.pct, branches.pct)

const pickColor = (value: number) =>
  COLOR_THRESHOLDS.find(([threshold]) => value >= threshold)?.[1] ?? LOW_COVERAGE_COLOR
const measureText = (text: string) => text.length * CHAR_WIDTH + TEXT_PADDING

const value = `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`
const labelWidth = measureText(LABEL)
const valueWidth = measureText(value)
const totalWidth = labelWidth + valueWidth

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${LABEL}: ${value}">
<title>${LABEL}: ${value}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
<rect width="${labelWidth}" height="20" fill="#555"/>
<rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${pickColor(percentage)}"/>
<rect width="${totalWidth}" height="20" fill="url(#s)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${LABEL}</text>
<text x="${labelWidth / 2}" y="14">${LABEL}</text>
<text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
<text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
</g>
</svg>
`

writeFileSync(BADGE_PATH, svg)
console.log(`${BADGE_PATH}: ${value}`)
