<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { calculateMaterial } from '../services/calculator.service'
import type { Material } from '../types/insulation'
const props = defineProps<{ material: Material }>(); const emit = defineEmits<{ update: [patch: Partial<Material>]; remove: [] }>()
const calc = computed(() => calculateMaterial(props.material))
const fields: Array<[keyof Material, string, string]> = [['description','Material description','text'], ['installationArea','Area (m²)','number'], ['coveragePerPack','Coverage / pack (m²)','number']]
function change(key: keyof Material, event: Event) { const input = event.target as HTMLInputElement; emit('update', { [key]: input.type === 'number' ? (input.value === '' ? undefined : Number(input.value)) : input.value } as Partial<Material>) }
</script>
<template><article class="material"><div class="material-head"><b>{{ material.confidence === 'review' ? 'Review required' : 'Confirmed' }}</b><button aria-label="Remove material" @click="emit('remove')"><Trash2 :size="16" /></button></div><label v-for="[key, label, type] in fields" :key="key">{{ label }}<input :type="type" :value="material[key]" min="0" step="0.01" @input="change(key, $event)" /></label><div class="metrics"><span><small>Required packs</small>{{ calc.requiredPacks ?? '—' }}</span></div></article></template>
