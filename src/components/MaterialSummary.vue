<script setup lang="ts">
import { computed } from 'vue'
import type { MaterialSummary } from '../types/insulation'
const props = defineProps<{ items: MaterialSummary[] }>(); const total = computed(() => props.items.reduce((sum, item) => sum + (item.requiredPacks ?? 0), 0))
</script>
<template><section v-if="items.length" class="panel summary"><div class="summary-title"><div><p class="eyebrow">Material summary</p><h2>Order list</h2></div><strong>{{ total }} <small>packs total</small></strong></div><div class="table"><article v-for="item in items" :key="`${item.description}-${item.width}`"><div><b>{{ item.description || [item.category, item.rValue, item.width && `${item.width}mm`].filter(Boolean).join(' ') }}</b><small>{{ item.installationArea.toFixed(2) }} m² · {{ item.jobs.length }} job{{ item.jobs.length === 1 ? '' : 's' }}</small></div><div><b>{{ item.requiredPacks ?? '—' }}</b><small>packs</small></div></article></div></section></template>
