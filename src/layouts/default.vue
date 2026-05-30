<template>
  <div class="layout">
    <Sidebar />
    <div class="main-content">
      <Header />
      <div class="content-wrapper">
        <div class="breadcrumb-bar">
          <span class="breadcrumb-item" @click="$router.push('/dashboard')">首页</span>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-item active">{{ currentTitle }}</span>
        </div>
        <div class="content">
          <router-view />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from '@/components/Sidebar.vue';
import Header from '@/components/Header.vue';

const route = useRoute();
const currentTitle = computed(() => (route.meta.title as string) || '页面');
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.layout {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  margin-left: $sidebar-width;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s ease;
}

.content-wrapper {
  flex: 1;
  padding: $spacing-lg;
}

.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.1);
  border-radius: $radius-sm;

  .breadcrumb-item {
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: #fff;
    }

    &.active {
      color: #fff;
      font-weight: 500;
    }
  }

  .breadcrumb-separator {
    color: rgba(255, 255, 255, 0.5);
  }
}

.content {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border-radius: $radius-lg;
  padding: $spacing-lg;
  min-height: calc(100vh - $header-height - 100px);
}
</style>