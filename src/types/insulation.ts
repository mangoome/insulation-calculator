export interface Material {
  id: string
  description: string
  insulationType?: string
  brand?: string
  category?: string
  rValue?: string
  width?: number
  coveragePerPack?: number
  installationArea?: number
  installTypeArea?: string
  installAreas?: string
  confidence: 'confirmed' | 'review'
}

export interface Job {
  id: string
  jobId?: string
  title?: string
  jobDate?: string
  materials: Material[]
  sourceText?: string
}

export interface MaterialSummary extends Material {
  installationArea: number
  requiredPacks?: number
  jobs: Array<{ jobId?: string; area?: number }>
}

export interface OCRWord { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }
export interface OCRResult { text: string; words: OCRWord[] }

export interface CalculationHistory {
  id: string
  createdAt: number
  updatedAt: number
  jobIds: string[]
  address?: string
  materials: Array<{
    name: string
    area: number
    coveragePerPack: number
    requiredPacks: number
  }>
  totalPacks: number
}
