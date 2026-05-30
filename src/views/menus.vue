<template>
  <div class="menus-page">
    <div class="page-header">
      <h2 class="page-title">菜单管理</h2>
      <button class="glass-btn">+ 新增菜单</button>
    </div>
    <div class="menu-tree glass-panel">
      <div v-for="menu in menus" :key="menu.id" class="menu-item">
        <div class="menu-row">
          <span class="menu-icon">{{ menu.icon }}</span>
          <span class="menu-name">{{ menu.name }}</span>
          <span class="menu-path">{{ menu.path }}</span>
          <span :class="['status-badge', menu.visible ? 'active' : 'inactive']">
            {{ menu.visible ? '显示' : '隐藏' }}
          </span>
          <div class="actions">
            <button class="action-btn edit">编辑</button>
            <button class="action-btn delete">删除</button>
          </div>
        </div>
        <div v-if="menu.children" class="menu-children">
          <div v-for="child in menu.children" :key="child.id" class="menu-item">
            <div class="menu-row child">
              <span class="menu-icon">{{ child.icon }}</span>
              <span class="menu-name">{{ child.name }}</span>
              <span class="menu-path">{{ child.path }}</span>
              <span :class="['status-badge', child.visible ? 'active' : 'inactive']">
                {{ child.visible ? '显示' : '隐藏' }}
              </span>
              <div class="actions">
                <button class="action-btn edit">编辑</button>
                <button class="action-btn delete">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const menus = ref([
  {
    id: 1, name: '仪表板', path: '/dashboard', icon: '📊', visible: true,
    children: [
      { id: 11, name: '数据分析', path: '/dashboard/analytics', icon: '📈', visible: true }
    ]
  },
  {
    id: 2, name: '系统管理', path: '/system', icon: '⚙️', visible: true,
    children: [
      { id: 21, name: '用户管理', path: '/users', icon: '👥', visible: true },
      { id: 22, name: '角色管理', path: '/roles', icon: '🔑', visible: true },
      { id: 23, name: '菜单管理', path: '/menus', icon: '📋', visible: true }
    ]
  },
  { id: 3, name: '系统日志', path: '/logs', icon: '📝', visible: true }
]);

onMounted(() => {
  console.log('[Menus] Page mounted, menus:', menus.value);
});
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.menus-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  color: #fff;
  font-size: 20px;
}

.menu-tree {
  padding: $spacing-md;
}

.menu-item {
  margin-bottom: $spacing-sm;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.05);
  border-radius: $radius-sm;

  &.child {
    margin-left: $spacing-xl;
    background: rgba(255, 255, 255, 0.03);
  }
}

.menu-icon {
  font-size: 18px;
}

.menu-name {
  color: #fff;
  font-weight: 500;
}

.menu-path {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-family: monospace;
  margin-left: auto;
}

.actions {
  display: flex;
  gap: $spacing-xs;
}
</style>