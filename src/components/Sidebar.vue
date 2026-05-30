<template>
  <aside class="sidebar" :class="{ collapsed: isCollapsed }">
    <div class="logo">
      <span class="logo-icon">⚡</span>
      <span v-show="!isCollapsed" class="logo-text">Admin Pro</span>
    </div>
    <nav class="menu">
      <div
        v-for="item in menuItems"
        :key="item.path"
        class="menu-item"
        :class="{ active: currentPath === item.path }"
        @click="navigate(item.path)"
      >
        <span class="menu-icon">{{ item.icon }}</span>
        <span v-show="!isCollapsed" class="menu-text">{{ item.title }}</span>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/store/app';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const isCollapsed = computed(() => appStore.sidebarCollapsed);
const currentPath = computed(() => route.path);

const menuItems = [
  { path: '/dashboard', icon: '📊', title: '仪表板' },
  { path: '/users', icon: '👥', title: '用户管理' },
  { path: '/roles', icon: '🔑', title: '角色管理' },
  { path: '/menus', icon: '📋', title: '菜单管理' },
  { path: '/logs', icon: '📝', title: '系统日志' },
  { path: '/settings', icon: '⚙️', title: '个人设置' }
];

const navigate = (path: string) => {
  router.push(path);
};
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  width: $sidebar-width;
  height: 100vh;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  z-index: 100;

  &.collapsed {
    width: $sidebar-collapsed-width;
  }
}

.logo {
  height: $header-height;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .logo-icon {
    font-size: 24px;
  }

  .logo-text {
    color: #fff;
    font-size: 18px;
    font-weight: 600;
  }
}

.menu {
  flex: 1;
  padding: $spacing-md 0;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-lg;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.7);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  &.active {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    border-left: 3px solid #667eea;
  }

  .menu-icon {
    font-size: 20px;
    min-width: 24px;
    text-align: center;
  }

  .menu-text {
    white-space: nowrap;
  }
}
</style>