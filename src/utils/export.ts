import type { MaterialSummary } from '../types/insulation'

export function summaryText(items: MaterialSummary[]): string {
  const rows = items.map(item => `${item.description} | ${item.installationArea.toFixed(2)} m² | ${item.requiredPacks ?? 'Review'} packs`)
  const total = items.reduce((sum, item) => sum + (item.requiredPacks ?? 0), 0)
  return `INSULATION MATERIAL SUMMARY\n\n${rows.join('\n')}\n\nTotal packs: ${total}`
}
export function downloadCsv(items: MaterialSummary[]): void {
  const head = 'Material,Area m2,Coverage per pack,Packs'
  const rows = items.map(x => [x.description, x.installationArea, x.coveragePerPack ?? '', x.requiredPacks ?? ''].map(v => `"${String(v).replaceAll('"', '""')}"`).join(','))
  const url = URL.createObjectURL(new Blob([[head, ...rows].join('\n')], { type: 'text/csv' }))
  const link = document.createElement('a'); link.href = url; link.download = 'insulation-materials.csv'; link.click(); URL.revokeObjectURL(url)
}
