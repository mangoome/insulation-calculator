import { describe, expect, it } from 'vitest'
import { calculateMaterial, summarizeMaterials } from './calculator.service'
import { parseJobs, parseMaterial } from './parser.service'
import { localOcrAssetPaths } from './ocr.service'

describe('material parsing', () => {
  it('extracts a ThermoBatts ceiling description', () => expect(parseMaterial('ThermoBatts Ceiling R4.1 580mm 7.40m2 per pack (8in1)')).toMatchObject({ brand: 'ThermoBatts', category: 'Ceiling', rValue: 'R4.1', width: 580, coveragePerPack: 7.4 }))
  it('handles Wall R2.5HD', () => expect(parseMaterial('ThermoBatts Wall R2.5HD 580mm 6.73m2 per pack (8in1)')).toMatchObject({ rValue: 'R2.5HD', coveragePerPack: 6.73 }))
  it('groups the four numbered insulation fields and creates the standard lot title', () => {
    const [job] = parseJobs('Job ID: 205958\nLot No: 1120\nStreet Name: LATROBE WAY\nSuburb: Lakelands\nInsulation type 1: ThermoBatts Ceiling R4.1 580mm 7.40m2 per pack (8in1)\nm2 of insulation type 1: 117m2\nInstall Type Area 1: Ceiling\nInstall Areas 1: Main house\nInsulation type 2: ThermoBatts Wall R2.5HD 580mm 6.73m2 per pack (8in1)\nm2 of insulation type 2: 96m2\nInstall Type Area 2: Wall\nInstall Areas 2: Garage')
    expect(job.title).toBe('L1120 Latrobe Way LAKELANDS')
    expect(job.materials).toMatchObject([{ installationArea: 117, coveragePerPack: 7.4, installTypeArea: 'Ceiling', installAreas: 'Main house' }, { installationArea: 96, coveragePerPack: 6.73, installTypeArea: 'Wall', installAreas: 'Garage' }])
  })
  it('splits separate jobs by Job ID', () => {
    const jobs = parseJobs('Job ID: 100\nInsulation type 1: A Ceiling R2 5m2 per pack\nm2 of insulation type 1: 10\nJob ID: 101\nInsulation type 1: B Wall R2 5m2 per pack\nm2 of insulation type 1: 20')
    expect(jobs.map(job => [job.jobId, job.materials[0].installationArea])).toEqual([['100', 10], ['101', 20]])
  })
  it('uses the full L-number date line as the job title', () => {
    const [job] = parseJobs('L1120 Latrobe Way LAKELANDS Tuesday, 20 October 2026\nJob ID: 205958\nInsulation type 1: ThermoBatts Ceiling R4.1 580mm 7.40m2\nm2 of insulation type 1: 117')
    expect(job.title).toBe('L1120 Latrobe Way LAKELANDS Tuesday, 20 October 2026')
  })
  it('splits numbered fields even when OCR returns the full form on one line', () => {
    const [job] = parseJobs('Job ID: 205958 Insulation type 1: ThermoBatts Ceiling R4.1 580mm 7.40m2 m2 of insulation type 1: 117 Install Type Area 1: Prior to ceilings - Timber Install Areas 1: House Insulation type 2: ThermoBatts Ceiling R4.1 430mm 5.49m2 m2 of insulation type 2: 30 Install Type Area 2: Prior to ceilings - Timber Install Areas 2: Garage')
    expect(job.materials).toMatchObject([
      { insulationType: 'ThermoBatts Ceiling R4.1 580mm 7.40m2', description: 'ThermoBatts Ceiling R4.1 580mm 7.40m2', installationArea: 117, coveragePerPack: 7.4, installTypeArea: 'Prior to ceilings - Timber', installAreas: 'House' },
      { insulationType: 'ThermoBatts Ceiling R4.1 430mm 5.49m2', description: 'ThermoBatts Ceiling R4.1 430mm 5.49m2', installationArea: 30, coveragePerPack: 5.49, installTypeArea: 'Prior to ceilings - Timber', installAreas: 'Garage' },
    ])
  })
})
describe('calculation', () => {
  it('rounds the required packs', () => expect(calculateMaterial({ id: '1', description: 'x', installationArea: 117, coveragePerPack: 7.4, confidence: 'confirmed' })).toEqual({ requiredPacks: 16 }))
  it('groups before rounding to 47 expected packs', () => { const materials = [[117,7.4],[32,5.49],[130,14.13],[96,6.73]].map(([area, coverage], i) => ({ id: String(i), description: String(i), category: String(i), installationArea: area, coveragePerPack: coverage, confidence: 'confirmed' as const })); expect(summarizeMaterials([{ jobId: 'test', materials }]).reduce((s, x) => s + (x.requiredPacks ?? 0), 0)).toBe(47) })
  it('does not divide by zero', () => expect(calculateMaterial({ id: '1', description: 'x', installationArea: 4, coveragePerPack: 0, confidence: 'confirmed' })).toEqual({}))
  it('uses local assets so offline OCR makes no CDN request', () => expect(localOcrAssetPaths('/')).toEqual({ workerPath: '/tesseract/worker.min.js', corePath: '/tesseract/core', langPath: '/tesseract/lang' }))
})
