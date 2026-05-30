<template>
  <div class="roles-page">
    <div class="page-header">
      <h2 class="page-title">角色管理</h2>
      <button class="glass-btn">+ 新增角色</button>
    </div>
    <div class="role-list">
      <div v-for="role in roles" :key="role.id" class="role-card glass-panel">
        <div class="role-header">
          <h3 class="role-name">{{ role.name }}</h3>
          <span class="role-count">{{ role.userCount }} 用户</span>
        </div>
        <p class="role-desc">{{ role.description }}</p>
        <div class="role-permissions">
          <span v-for="perm in role.permissions" :key="perm" class="perm-tag">{{ perm }}</span>
        </div>
        <div class="role-actions">
          <button class="action-btn edit">编辑</button>
          <button class="action-btn delete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const roles = ref([
  { id: 1, name: '超级管理员', description: '拥有所有权限', userCount: 2, permissions: ['全部权限'] },
  { id: 2, name: '编辑', description: '内容编辑权限', userCount: 5, permissions: ['文章管理', '评论管理', '媒体管理'] },
  { id: 3, name: '访客', description: '只读权限', userCount: 12, permissions: ['查看内容'] }
]);

onMounted(() => {
  console.log('[Roles] Page mounted, roles:', roles.value);
});
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.roles-page {
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

.role-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $spacing-md;
}

.role-card {
  padding: $spacing-lg;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.role-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-name {
  color: #fff;
  font-size: 18px;
}

.role-count {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.role-desc {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.role-permissions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
}

.perm-tag {
  padding: 4px 8px;
  background: rgba(102, 126, 234, 0.2);
  color: #667eea;
  border-radius: 4px;
  font-size: 12px;
}

.role-actions {
  display: flex;
  gap: $spacing-sm;
  margin-top: $spacing-sm;
  padding-top: $spacing-sm;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>