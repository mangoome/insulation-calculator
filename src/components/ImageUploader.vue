<script setup lang="ts">
import { ref } from 'vue'
import { Search, Upload, X } from 'lucide-vue-next'
const emit = defineEmits<{ analyze: [files: File[]] }>()
const files = ref<File[]>([]); const input = ref<HTMLInputElement>()
function add(list: FileList | null) { const next = [...(list ?? [])].filter(file => /image\/(png|jpeg|webp)/.test(file.type)); files.value.push(...next) }
function drop(event: DragEvent) { event.preventDefault(); add(event.dataTransfer?.files ?? null) }
function preview(file: File) { return URL.createObjectURL(file) }
function analyze() { if (files.value.length) emit('analyze', [...files.value]) }
</script>
<template>
  <section class="panel upload" @dragover.prevent @drop="drop">
    <input ref="input" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden @change="add(input?.files ?? null)" />
    <Upload :size="28" /><h2>Upload work orders</h2><p>Drop PNG, JPG or WEBP files here, then start analysis when ready.</p>
    <div class="actions"><button class="primary" @click="input?.click()"><Upload :size="17" /> Choose images</button><button v-if="files.length" @click="analyze"><Search :size="17" /> Analyze images</button></div>
    <div v-if="files.length" class="previews"><article v-for="(file, index) in files" :key="`${file.name}-${index}`"><img :src="preview(file)" :alt="file.name" /><span>{{ file.name }}</span><button aria-label="Remove image" @click="files.splice(index, 1)"><X :size="15" /></button></article></div>
  </section>
</template>
