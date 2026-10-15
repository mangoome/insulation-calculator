<script setup lang="ts">
interface Props {
  progress: number
  file?: string
  error?: string | null
}
defineProps<Props>()
</script>
<template><section v-if="file || error" class="panel processing"><div v-if="file"><strong>Reading {{ file }}</strong><span>{{ progress }}%</span><div class="bar"><i :style="{ width: `${progress}%` }" /></div></div><p v-if="error" class="error">{{ error }}</p></section></template>
