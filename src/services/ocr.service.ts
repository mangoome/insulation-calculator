import { createWorker, type Worker } from 'tesseract.js'
import type { OCRResult } from '../types/insulation'

let worker: Worker | null = null
export function localOcrAssetPaths(base = import.meta.env.BASE_URL): { workerPath: string; corePath: string; langPath: string } {
  const local = `${base}tesseract/`
  return { workerPath: `${local}worker.min.js`, corePath: `${local}core`, langPath: `${local}lang` }
}
export async function recogniseImage(image: Blob | File, onProgress: (progress: number) => void): Promise<OCRResult> {
  const localPaths = localOcrAssetPaths()
  worker ??= await createWorker('eng', 1, {
    ...localPaths,
    logger: event => { if (event.status === 'recognizing text') onProgress(Math.round(event.progress * 100)) },
  })
  const { data } = await worker.recognize(image)
  return { text: data.text, words: data.words.map(word => ({ text: word.text, confidence: word.confidence, bbox: word.bbox })) }
}
export async function disposeOCR(): Promise<void> { if (worker) { await worker.terminate(); worker = null } }
