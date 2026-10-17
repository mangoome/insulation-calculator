<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Clipboard, Download, History, Plus, Share2, Sparkles, Wifi, WifiOff } from 'lucide-vue-next'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import ImageUploader from './components/ImageUploader.vue'
import OCRProgress from './components/OCRProgress.vue'
import JobCard from './components/JobCard.vue'
import MaterialSummary from './components/MaterialSummary.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import { useOCR } from './composables/useOCR'
import { useInsulationStore } from './stores/insulation.store'
import { downloadCsv, summaryText } from './utils/export'
import { createHistoryRecord, historyService } from './services/history.service'
import { parseMaterial } from './services/parser.service'
import type { CalculationHistory, Job } from './types/insulation'

const store = useInsulationStore(); const { progress, currentFile, error, process } = useOCR()
const processing = ref(false); const status = ref(''); const storageError = ref(''); const history = ref<CalculationHistory[]>([]); const analysisText = ref(''); const analyzedJobs = ref<Job[]>([])
const debugMode = ref(false)
const showHistory = ref(false); const activeHistoryId = ref<string | null>(null); const online = ref(navigator.onLine)
let saveTimer: ReturnType<typeof setTimeout> | undefined; let logoTapTimer: ReturnType<typeof setTimeout> | undefined; let logoTapCount = 0
const canShare = computed(() => typeof navigator !== 'undefined' && 'share' in navigator)
const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true })

async function refreshHistory() { try { history.value = await historyService.list() } catch { storageError.value = 'Saved history could not be read from this device.' } }
function hasCalculableMaterial() { return store.summary.some(item => item.requiredPacks !== undefined) }
async function saveCurrent(showNotice = false) {
  if (!hasCalculableMaterial()) return
  try {
    const record = createHistoryRecord(store.jobs, store.summary, activeHistoryId.value ?? undefined)
    const saved = await historyService.save(record); activeHistoryId.value = saved.id; await refreshHistory()
    if (showNotice) status.value = 'Calculation saved on this device.'
  } catch (cause) { storageError.value = cause instanceof Error ? cause.message : 'Could not save this calculation.' }
}
function queueSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(() => void saveCurrent(), 600) }
watch(() => store.jobs, queueSave, { deep: true })
async function analyzeFiles(files: File[]) {
  showHistory.value = false; processing.value = true
  analysisText.value = ''; analyzedJobs.value = []
  for (const file of files) try {
    const result = await process(file, file.name)
    analysisText.value += `${analysisText.value ? '\n\n' : ''}--- ${file.name} ---\n${result.text.trim() || '(No text found)'}`
    analyzedJobs.value.push(...result.jobs)
    result.jobs.length ? store.jobs.push(...result.jobs) : store.addJob({ sourceText: result.text || 'No fields were confidently found. Add them manually.' })
  } catch { /* inline error is shown */ }
  processing.value = false; await saveCurrent(true)
}
async function copy() { await navigator.clipboard.writeText(summaryText(store.summary)); status.value = 'Copied to clipboard.' }
async function share() { const text = summaryText(store.summary); if (navigator.share) await navigator.share({ title: 'Insulation material summary', text }); else await copy() }
function newCalculation() { if (saveTimer) clearTimeout(saveTimer); store.clearJobs(); activeHistoryId.value = null; showHistory.value = false; status.value = 'New calculation started.' }
function restoreRecord(record: CalculationHistory) {
  const job: Job = { id: crypto.randomUUID(), jobId: record.jobIds.join(', '), title: record.address, materials: record.materials.map((item, index) => ({ id: `history-${index}`, ...parseMaterial(item.name), description: item.name, installationArea: item.area, coveragePerPack: item.coveragePerPack, confidence: 'confirmed' })) }
  store.replaceJobs([job]); activeHistoryId.value = record.id; showHistory.value = false; status.value = 'Saved calculation restored.'
}
async function deleteRecord(id: string) { try { await historyService.remove(id); if (activeHistoryId.value === id) activeHistoryId.value = null; await refreshHistory(); status.value = 'History item deleted.' } catch (cause) { storageError.value = cause instanceof Error ? cause.message : 'Could not delete this history item.' } }
async function clearHistory() { if (!window.confirm('Delete all saved calculations from this device? This cannot be undone.')) return; try { await historyService.clear(); activeHistoryId.value = null; await refreshHistory(); status.value = 'All history cleared.' } catch (cause) { storageError.value = cause instanceof Error ? cause.message : 'Could not clear history.' } }
async function backup() { try { const text = await historyService.backup(); const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'insulation-history-backup.json'; link.click(); URL.revokeObjectURL(url) } catch { storageError.value = 'Could not create history backup.' } }
async function restoreBackup(file: File) { try { const count = await historyService.restore(await file.text()); await refreshHistory(); status.value = `${count} history item${count === 1 ? '' : 's'} restored.` } catch (cause) { storageError.value = cause instanceof Error ? cause.message : 'Could not restore backup.' } }
function updateOnlineStatus() { online.value = navigator.onLine }
function toggleDebugFromLogo() {
  logoTapCount += 1
  if (logoTapTimer) clearTimeout(logoTapTimer)
  if (logoTapCount === 5) { debugMode.value = !debugMode.value; logoTapCount = 0; return }
  logoTapTimer = setTimeout(() => { logoTapCount = 0 }, 1500)
}
const analyzedObjectText = computed(() => JSON.stringify(analyzedJobs.value.map(job => ({
  jobId: job.jobId,
  title: job.title,
  insulationTypes: job.materials.map(material => ({
    insulationType: material.insulationType,
    description: material.description,
    areaM2: material.installationArea,
    coveragePerPackM2: material.coveragePerPack,
    installTypeArea: material.installTypeArea,
    installAreas: material.installAreas,
  })),
})), null, 2))
onMounted(() => { void refreshHistory(); window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus) })
onBeforeUnmount(() => { if (saveTimer) clearTimeout(saveTimer); if (logoTapTimer) clearTimeout(logoTapTimer); window.removeEventListener('online', updateOnlineStatus); window.removeEventListener('offline', updateOnlineStatus) })
</script>
<template>
  <main>
    <header class="hero">
      <button type="button" class="brand" aria-label="Insulation Calculator" @click="toggleDebugFromLogo">
        <Sparkles :size="21" /><span>Insulation Calculator</span>
      </button><button class="history-button" @click="showHistory = !showHistory">
        <History :size="17" /> {{ showHistory ? 'Calculator' : 'History' }}
      </button>
      <h1>Turn work orders into<br /><em>an accurate material list.</em></h1>
      <p>Private, on-device OCR for insulation installers. Nothing is uploaded to a server.</p>
      <div class="connection" :class="{ offline: !online }">
        <Wifi v-if="online" :size="15" />
        <WifiOff v-else :size="15" /> {{ online ? 'Online — offline ready after setup' : 'Offline — local mode' }}
      </div>
    </header>
    <div class="page">
      <div v-if="offlineReady" class="notice">Offline Ready — this app and its English OCR resources are cached on this
        device.</div>
      <div v-if="needRefresh" class="notice update">A new version is ready. <button
          @click="updateServiceWorker(true)">Update now</button></div>
      <p v-if="storageError" class="error storage-error">{{ storageError }}</p>
      <HistoryPanel v-if="showHistory" :records="history" :error="storageError" @select="restoreRecord"
        @remove="deleteRecord" @clear="clearHistory" @backup="backup" @restore="restoreBackup" />
      <template v-else>
        <div class="top-actions"><button @click="newCalculation">New calculation</button><button
            @click="showHistory = true">
            <History :size="17" /> History ({{ history.length }})
          </button></div>
        <ImageUploader @analyze="analyzeFiles" />
        <OCRProgress :progress="progress" :file="processing ? currentFile : ''" :error="error" />
        <section v-if="analysisText && debugMode" class="panel analysis-result">
          <p class="eyebrow">Temporary test output</p>
          <h2>Raw OCR text</h2>
          <p>Exact text read from the uploaded image.</p>
          <pre>{{ analysisText }}</pre>
        </section><section v-if="analysisText && debugMode" class="panel analysis-result">
          <p class="eyebrow">Temporary test output</p>
          <h2>Separated job objects</h2>
          <p>Each object is split by Job ID and grouped by its insulation type number.</p>
          <pre class="object-output">{{ analyzedObjectText }}</pre>
        </section>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Job details</p>
            <h2>Check each material</h2>
          </div><button @click="store.addJob()">
            <Plus :size="17" /> Add job
          </button>
        </div>
        <p v-if="!store.jobs.length" class="empty">Upload a work order to start, then use Analyze images, or add a job
          and enter the materials manually.</p>
        <JobCard v-for="job in store.jobs" :key="job.id" :job="job" @remove="store.removeJob(job.id)"
          @add-material="store.addMaterial(job.id)" @update-job="store.updateJob(job.id, $event)"
          @update-material="(id, patch) => store.updateMaterial(job.id, id, patch)"
          @remove-material="store.removeMaterial(job.id, $event)" />
        <MaterialSummary :items="store.summary" />
        <div v-if="store.summary.length" class="exports"><button class="primary" @click="copy">
            <Clipboard :size="17" /> Copy result
          </button><button @click="downloadCsv(store.summary)">
            <Download :size="17" /> Download CSV
          </button><button v-if="canShare" @click="share">
            <Share2 :size="17" /> Share
          </button><button @click="saveCurrent(true)">Save now</button><span>{{ status }}</span></div>
      </template>
    </div>
    <footer class="site-footer">
      <a href="/privacy/">Privacy Policy</a>
    </footer>
  </main>
</template>
