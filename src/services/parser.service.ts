import { z } from 'zod'
import type { Job, Material } from '../types/insulation'

const number = z.number().positive().finite().optional()
export const materialSchema = z.object({ description: z.string(), brand: z.string().optional(), category: z.string().optional(), rValue: z.string().optional(), width: number, coveragePerPack: number, installationArea: number, confidence: z.enum(['confirmed', 'review']) })

export function normaliseOCR(text: string): string {
  return text.replace(/\r/g, '').replace(/[|]/g, ' ').replace(/(?<=\d)[oO](?=\d)/g, '0').replace(/m\s*2/gi, 'm2').replace(/\s+/g, ' ').trim()
}

export function parseMaterial(description: string): Partial<Material> {
  const text = normaliseOCR(description)
  const brand = text.match(/^([A-Za-z][A-Za-z-]*)/)?.[1]
  const category = text.match(/\b(Ceiling|Wall|Underfloor|Floor)\b/i)?.[1]
  const rValue = text.match(/\bR\s*([0-9](?:\.[0-9]+)?(?:HD)?)\b/i)?.[0]?.replace(/\s/g, '').toUpperCase()
  const width = Number(text.match(/\b(\d{3,4})\s*(?:mm|m m)\b/i)?.[1]) || undefined
  const lastM2Value = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*m2\b/gi)].at(-1)?.[1]
  const coveragePerPack = Number(text.match(/\b(\d+(?:\.\d+)?)\s*m2\s*(?:per\s*)?(?:pack|pkt)\b/i)?.[1] ?? lastM2Value) || undefined
  return { description: text, brand, category: category ? category[0].toUpperCase() + category.slice(1).toLowerCase() : undefined, rValue, width, coveragePerPack }
}

export function parseInstallationArea(description: string): number | undefined {
  const text = normaliseOCR(description)
  const labelled = text.match(/(?:installation\s*area|area|m2\s*of\s*insulation(?:\s*type\s*\d+)?|insulation\s*type\s*\d+)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*m2?\b/i)
    ?? text.match(/(\d+(?:\.\d+)?)\s*m2?\s*(?:installation\s*area|area|of\s*insulation)/i)
  if (labelled) return Number(labelled[1]) || undefined

  const values = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*m2\b/gi)]
    .filter(match => !/^\s*(?:per\s*)?(?:pack|pkt)\b/i.test(text.slice((match.index ?? 0) + match[0].length)))
  return values.length === 1 ? Number(values[0][1]) || undefined : undefined
}

const formLabels = [
  'Job ID', 'Lot No', 'Street Name', 'Street Address', 'Road Name', 'Site Address', 'Address', 'Suburb',
  'Insulation type 1', 'm2 of insulation type 1', 'Install Type Area 1', 'Install Areas 1',
  'Insulation type 2', 'm2 of insulation type 2', 'Install Type Area 2', 'Install Areas 2',
] as const

type FormLabel = typeof formLabels[number]
type BoundFields = Partial<Record<FormLabel, string>>

function bindFields(source: string): BoundFields {
  // The small italic number in the printed field label is often read as I or l.
  // Restrict this correction to the label itself so material descriptions are untouched.
  const text = normaliseOCR(source)
    .replace(/[\[{(]?msulation\b/gi, 'Insulation')
    .replace(/(?:^|[\s-])[\[{(]reas\s+([Il12])\b/gi, ' Install Areas $1')
    .replace(/\b((?:m2\s+of\s+)?insulation\s+type\s+)[Il]\b/gi, '$11')
  const lower = text.toLowerCase()
  const markers = formLabels.flatMap(label => {
    const matches: Array<{ label: FormLabel; start: number; end: number }> = []
    let start = lower.indexOf(label.toLowerCase())
    while (start !== -1) {
      matches.push({ label, start, end: start + label.length })
      start = lower.indexOf(label.toLowerCase(), start + label.length)
    }
    return matches
  }).sort((first, second) => first.start - second.start || second.end - second.start - (first.end - first.start))

  // "Insulation type 1" appears inside "m2 of insulation type 1"; retain only the full field label there.
  const labels = markers.filter((marker, index) => !markers.slice(0, index).some(previous => marker.start >= previous.start && marker.start < previous.end))
  return labels.reduce<BoundFields>((fields, marker, index) => {
    const nextStart = labels[index + 1]?.start ?? text.length
    const value = text.slice(marker.end, nextStart).replace(/^\s*[:=-]\s*/, '').trim()
    if (value) fields[marker.label] = value
    return fields
  }, {})
}

function repairWrappedPackNotes(fields: BoundFields, source: string): BoundFields {
  const type1 = fields['Insulation type 1']
  let type2 = fields['Insulation type 2']
  const packNotes = [...normaliseOCR(source).matchAll(/\bper\s*pack(?:\s*\([^)]*\))?/gi)].map(match => match[0])

  // In side-by-side fields, OCR can place both wrapped notes after type 2.
  // When two notes exist, the first still belongs to type 1.
  if (type1 && type2 && packNotes.length >= 2 && !/\bper\s*pack\b/i.test(type1)) {
    const firstPackInType2 = type2.match(/per\s*pack(?:\s*\([^)]*\))?/i)?.[0]
    if (firstPackInType2) {
      fields['Insulation type 1'] = `${type1} ${firstPackInType2}`.trim()
      type2 = type2.replace(firstPackInType2, '').trim()
      fields['Insulation type 2'] = type2
    }
  }

  const leadingPack = type2?.match(/^\s*(per\s*pack(?:\s*\([^)]*\))?)/i)?.[1]
  if (!leadingPack || !type2) return fields

  // In a two-column form, OCR can place the type 2 label between type 1's first
  // line and its wrapped "per pack" note. Move that first note back to type 1.
  if (type1 && !/\bper\s*pack\b/i.test(type1)) fields['Insulation type 1'] = `${type1} ${leadingPack}`.trim()
  const remainingType2 = type2.slice(leadingPack.length).trim()
  // A lone wrapped note is not a material, so it must not create a type 2 object.
  if (!remainingType2) { delete fields['Insulation type 2']; return fields }

  // With two pack notes, the second one belongs to the type 2 material. Keep it
  // attached even if OCR split it away from the rest of that material description.
  if (packNotes.length >= 2 && !/\bper\s*pack\b/i.test(remainingType2)) fields['Insulation type 2'] = `${remainingType2} ${packNotes[1]}`.trim()
  else fields['Insulation type 2'] = remainingType2
  return fields
}

function splitJobs(source: string): string[] {
  const lines = source.split('\n')
  const titleLineIndexes = lines.reduce<number[]>((indexes, line, index) => {
    if (/^\s*L\d+\b/i.test(line) && /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*$/i.test(line.trim())) indexes.push(index)
    return indexes
  }, [])
  if (titleLineIndexes.length) return titleLineIndexes.map((lineIndex, index) => lines.slice(lineIndex, titleLineIndexes[index + 1]).join('\n').trim())

  const lower = source.toLowerCase()
  const jobLabel = 'job id'
  const starts: number[] = []
  let start = lower.indexOf(jobLabel)
  while (start !== -1) { starts.push(start); start = lower.indexOf(jobLabel, start + jobLabel.length) }
  return starts.length ? starts.map((position, index) => source.slice(index === 0 ? 0 : position, starts[index + 1]).trim()) : [source]
}

function numberedInsulation(fields: BoundFields, type: 1 | 2): Material | undefined {
  const materialText = fields[`Insulation type ${type}`]
  const areaText = fields[`m2 of insulation type ${type}`]
  const installTypeArea = fields[`Install Type Area ${type}`]
  const installAreas = fields[`Install Areas ${type}`]
  if (!materialText && !areaText && !installTypeArea && !installAreas) return undefined
  const installationArea = areaText?.match(/\d+(?:\.\d+)?/)?.[0]
  return {
    id: `type-${type}`,
    insulationTypeNumber: type,
    ...parseMaterial(materialText ?? installTypeArea ?? ''),
    insulationType: materialText,
    installationArea: installationArea ? Number(installationArea) : undefined,
    installTypeArea,
    installAreas,
    confidence: 'review',
  } as Material
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase())
}

function jobTitle(fields: BoundFields, source: string): { title?: string } {
  const originalTitle = source.split('\n').map(line => line.trim()).find(line => /^L\d+\b/i.test(line) && /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*$/i.test(line))
  if (originalTitle) return { title: originalTitle }
  const lotNo = fields['Lot No']?.match(/\d+[A-Za-z-]*/)?.[0]
  const road = fields['Street Name'] ?? fields['Street Address'] ?? fields['Road Name'] ?? fields['Site Address'] ?? fields.Address
  const suburb = fields.Suburb
  const title = [lotNo && `L${lotNo}`, road && titleCase(road), suburb?.toUpperCase()].filter(Boolean).join(' ') || undefined
  return { title }
}

export function parseJobs(source: string): Job[] {
  const chunks = splitJobs(source.replace(/\r/g, '')).filter(part => part.trim())
  return chunks.map((chunk, index) => {
    const fields = repairWrappedPackNotes(bindFields(chunk), chunk)
    const materials = ([1, 2] as const).map(type => numberedInsulation(fields, type)).filter((material): material is Material => Boolean(material))
    return { id: crypto.randomUUID(), jobId: fields['Job ID'], ...jobTitle(fields, chunk), materials, sourceText: chunk }
  }).filter(job => job.jobId || job.materials.length)
}
