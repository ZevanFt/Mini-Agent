<template>
  <header class="header">
    <div class="header-left">
      <button class="toggle-btn" @click="appStore.toggleSidebar">☰</button>
      <span class="page-title">{{ pageTitle }}</span>
    </div>
    <div class="header-right">
      <button class="glass-btn">🔔</button>
      <div class="user-info" @click="$router.push('/settings')">
        <span class="username">Admin</span>
        <span class="avatar">👤</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/store/app';

const route = useRoute();
const appStore = useAppStore();

const pageTitle = computed(() => (route.meta.title as string) || 'Admin System');
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.header {
  height: $header-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 $spacing-lg;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.toggle-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  padding: $spacing-xs;
  border-radius: $radius-sm;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.page-title {
  color: #fff;
  font-size: 16px;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.glass-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: $spacing-xs;
  border-radius: $radius-sm;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-xs $spacing-sm;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .username {
    color: #fff;
    font-size: 14px;
  }

  .avatar {
    font-size: 24px;
  }
}
</style>