import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HistoryService } from './history.service'
import type { CalculationHistory } from '../types/insulation'

const services: HistoryService[] = []
function service() { const item = new HistoryService(`history-test-${crypto.randomUUID()}`); services.push(item); return item }
function record(id: string, time: number): CalculationHistory { return { id, createdAt: time, updatedAt: time, jobIds: [id], materials: [{ name: 'Ceiling R4.1', area: 117, coveragePerPack: 7.4, requiredPacks: 16 }], totalPacks: 16 } }
afterEach(async () => { await Promise.all(services.splice(0).map(async item => { await item.clear(); await item.close() })) })

describe('calculation history', () => {
  it('automatically persists completed calculations and lists newest first', async () => { const db = service(); await db.save(record('a', 1)); await db.save(record('b', 2)); expect((await db.list()).map(item => item.id)).toEqual(['b', 'a']) })
  it('keeps at most ten entries and removes the oldest eleventh record', async () => { const db = service(); for (let index = 0; index < 11; index++) await db.save(record(String(index), index)); const items = await db.list(); expect(items).toHaveLength(10); expect(items.some(item => item.id === '0')).toBe(false) })
  it('updates an existing record without duplication', async () => { const db = service(); await db.save(record('same', 1)); await db.save({ ...record('same', 2), totalPacks: 42 }); const items = await db.list(); expect(items).toHaveLength(1); expect(items[0].totalPacks).toBe(42) })
  it('deletes one record or all records', async () => { const db = service(); await db.save(record('a', 1)); await db.save(record('b', 2)); await db.remove('a'); expect((await db.list()).map(item => item.id)).toEqual(['b']); await db.clear(); expect(await db.list()).toEqual([]) })
  it('keeps records when the database is opened again', async () => { const name = `history-persist-${crypto.randomUUID()}`; const first = new HistoryService(name); await first.save(record('persisted', 1)); await first.close(); const restarted = new HistoryService(name); expect((await restarted.list()).map(item => item.id)).toEqual(['persisted']); await restarted.clear(); await restarted.close() })
  it('backs up and restores only the newest ten records', async () => { const db = service(); for (let index = 0; index < 11; index++) await db.save(record(String(index), index)); const backup = await db.backup(); await db.clear(); expect(await db.restore(backup)).toBe(10); expect((await db.list()).some(item => item.id === '0')).toBe(false) })
})
