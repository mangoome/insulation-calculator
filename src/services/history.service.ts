import Dexie, { type Table } from 'dexie'
import type { CalculationHistory, Job, MaterialSummary } from '../types/insulation'

const LIMIT = 10

class HistoryDatabase extends Dexie {
  calculations!: Table<CalculationHistory, string>
  constructor(name = 'insulation-calculator') {
    super(name)
    this.version(1).stores({ calculations: 'id, updatedAt, createdAt' })
  }
}

export function createHistoryRecord(jobs: Job[], summary: MaterialSummary[], id: string = crypto.randomUUID(), createdAt = Date.now()): CalculationHistory {
  return {
    id, createdAt, updatedAt: Date.now(), jobIds: jobs.map(job => job.jobId).filter((id): id is string => Boolean(id)),
    address: jobs.map(job => job.title).find(Boolean),
    materials: summary.filter(item => item.requiredPacks !== undefined).map(item => ({
      name: item.description || [item.brand, item.category, item.rValue, item.width && `${item.width}mm`].filter(Boolean).join(' '),
      area: item.installationArea,
      coveragePerPack: item.coveragePerPack ?? 0,
      requiredPacks: item.requiredPacks ?? 0,
    })),
    totalPacks: summary.reduce((sum, item) => sum + (item.requiredPacks ?? 0), 0),
  }
}

export class HistoryService {
  private readonly db: HistoryDatabase
  constructor(name?: string) { this.db = new HistoryDatabase(name) }
  async list(): Promise<CalculationHistory[]> { return this.db.calculations.orderBy('updatedAt').reverse().toArray() }
  async save(record: CalculationHistory): Promise<CalculationHistory> {
    try {
      await this.db.transaction('rw', this.db.calculations, async () => {
        const existing = await this.db.calculations.get(record.id)
        await this.db.calculations.put({ ...record, createdAt: existing?.createdAt ?? record.createdAt, updatedAt: Date.now() })
        const excess = await this.db.calculations.orderBy('updatedAt').reverse().offset(LIMIT).toArray()
        await this.db.calculations.bulkDelete(excess.map(item => item.id))
      })
      return (await this.db.calculations.get(record.id))!
    } catch (error) { throw new Error(`Could not save calculation history: ${error instanceof Error ? error.message : 'storage error'}`) }
  }
  async remove(id: string): Promise<void> { try { await this.db.calculations.delete(id) } catch { throw new Error('Could not delete this history item.') } }
  async clear(): Promise<void> { try { await this.db.calculations.clear() } catch { throw new Error('Could not clear calculation history.') } }
  async backup(): Promise<string> { return JSON.stringify({ version: 1, calculations: await this.list() }, null, 2) }
  async restore(json: string): Promise<number> {
    try {
      const parsed: unknown = JSON.parse(json)
      if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { calculations?: unknown }).calculations)) throw new Error('Invalid backup file')
      const records = (parsed as { calculations: CalculationHistory[] }).calculations.filter(record => record && typeof record.id === 'string' && Array.isArray(record.materials)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, LIMIT)
      await this.db.transaction('rw', this.db.calculations, async () => { await this.db.calculations.clear(); await this.db.calculations.bulkPut(records) })
      return records.length
    } catch (error) { throw new Error(`Could not restore backup: ${error instanceof Error ? error.message : 'invalid file'}`) }
  }
  async close(): Promise<void> { this.db.close() }
}

export const historyService = new HistoryService()
