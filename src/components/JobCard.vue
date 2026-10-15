<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import MaterialEditor from './MaterialEditor.vue'
import type { Job, Material } from '../types/insulation'
const props = defineProps<{ job: Job }>(); const emit = defineEmits<{ remove: []; addMaterial: []; updateMaterial: [id: string, patch: Partial<Material>]; removeMaterial: [id: string]; updateJob: [patch: Partial<Job>] }>()
function updateJob(key: 'jobId' | 'title', event: Event) { emit('updateJob', { [key]: (event.target as HTMLInputElement).value }) }
</script>
<template><section class="panel job"><header><div><input class="job-id" :value="props.job.jobId" placeholder="Job ID" @input="updateJob('jobId', $event)" /><input :value="props.job.title" placeholder="Title" @input="updateJob('title', $event)" /></div><button aria-label="Delete job" @click="emit('remove')"><Trash2 :size="18" /></button></header><MaterialEditor v-for="material in props.job.materials" :key="material.id" :material="material" @update="emit('updateMaterial', material.id, $event)" @remove="emit('removeMaterial', material.id)" /><button class="add-line" @click="emit('addMaterial')"><Plus :size="16" /> Add material</button></section></template>
