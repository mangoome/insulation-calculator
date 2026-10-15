import { ref } from 'vue'
import { recogniseImage } from '../services/ocr.service'
import { parseJobs } from '../services/parser.service'
import type { Job } from '../types/insulation'

export interface OCRProcessResult { jobs: Job[]; text: string }

export function useOCR() {
  const progress = ref(0); const currentFile = ref(''); const error = ref<string | null>(null)
  async function process(file: File | Blob, name = 'image'): Promise<OCRProcessResult> {
    try { error.value = null; progress.value = 0; currentFile.value = name; const result = await recogniseImage(file, value => progress.value = value); progress.value = 100; return { jobs: parseJobs(result.text), text: result.text } }
    catch (cause) { error.value = cause instanceof Error ? cause.message : 'OCR failed.'; throw cause }
  }
  return { progress, currentFile, error, process }
}
