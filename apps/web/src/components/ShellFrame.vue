<template>
  <main class="shell" :class="'shell-' + tone">
    <aside class="shell-sidebar">
      <strong>{{ title }}</strong>
      <span>{{ subtitle }}</span>
    </aside>
    <section class="shell-content">
      <slot />
    </section>
  </main>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle: string;
  tone: "entry" | "admin" | "partner" | "mobile" | "error";
}>();
</script>
