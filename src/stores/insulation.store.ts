import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { summarizeMaterials } from '../services/calculator.service'
import type { Job, Material } from '../types/insulation'

export const useInsulationStore = defineStore('insulation', () => {
  const jobs = ref<Job[]>([])
  const summary = computed(() => summarizeMaterials(jobs.value))
  const totalPacks = computed(() => summary.value.reduce((total, material) => total + (material.requiredPacks ?? 0), 0))
  function addJob(job?: Partial<Job>) { jobs.value.push({ id: crypto.randomUUID(), materials: [], ...job }) }
  function removeJob(id: string) { jobs.value = jobs.value.filter(job => job.id !== id) }
  function addMaterial(jobId: string) { const job = jobs.value.find(item => item.id === jobId); job?.materials.push({ id: crypto.randomUUID(), description: '', confidence: 'review' }) }
  function removeMaterial(jobId: string, id: string) { const job = jobs.value.find(item => item.id === jobId); if (job) job.materials = job.materials.filter(material => material.id !== id) }
  function updateMaterial(jobId: string, id: string, patch: Partial<Material>) { const material = jobs.value.find(job => job.id === jobId)?.materials.find(item => item.id === id); if (material) Object.assign(material, patch) }
  function updateJob(id: string, patch: Partial<Job>) { const job = jobs.value.find(item => item.id === id); if (job) Object.assign(job, patch) }
  function replaceJobs(next: Job[]) { jobs.value = next }
  function clearJobs() { jobs.value = [] }
  return { jobs, summary, totalPacks, addJob, removeJob, addMaterial, removeMaterial, updateMaterial, updateJob, replaceJobs, clearJobs }
})
