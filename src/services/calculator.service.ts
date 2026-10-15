import type { Material, MaterialSummary } from '../types/insulation'

export const safePositive = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined

export function calculateMaterial(material: Material): Pick<MaterialSummary, 'requiredPacks'> {
  const area = safePositive(material.installationArea)
  const coverage = safePositive(material.coveragePerPack)
  if (!area || !coverage) return {}
  const requiredPacks = Math.ceil(area / coverage)
  return { requiredPacks }
}

export function materialKey(material: Material): string {
  return [material.brand, material.category, material.rValue, material.width, material.coveragePerPack]
    .map(value => value ?? '')
    .join('|')
}

export function summarizeMaterials(jobs: Array<{ jobId?: string; materials: Material[] }>): MaterialSummary[] {
  const groups = new Map<string, MaterialSummary>()
  for (const job of jobs) for (const material of job.materials) {
    const key = materialKey(material)
    const existing = groups.get(key)
    if (existing) {
      existing.installationArea += material.installationArea ?? 0
      existing.jobs.push({ jobId: job.jobId, area: material.installationArea })
    } else {
      groups.set(key, { ...material, installationArea: material.installationArea ?? 0, jobs: [{ jobId: job.jobId, area: material.installationArea }] })
    }
  }
  return [...groups.values()].map(item => ({ ...item, ...calculateMaterial(item) }))
}
