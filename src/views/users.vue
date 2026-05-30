<template>
  <div class="users-page">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <button class="glass-btn" @click="showAddDialog = true">+ 新增用户</button>
    </div>
    <div class="search-bar glass-panel">
      <input
        v-model="searchKeyword"
        class="glass-input search-input"
        placeholder="搜索用户名或邮箱..."
        @keyup.enter="handleSearch"
      />
      <button class="glass-btn" @click="handleSearch">搜索</button>
      <button class="glass-btn" @click="resetSearch">重置</button>
    </div>
    <div class="table-wrapper glass-panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in paginatedUsers" :key="user.id">
            <td>{{ user.id }}</td>
            <td>{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.role }}</td>
            <td>
              <span :class="['status-badge', user.status ? 'active' : 'inactive']">
                {{ user.status ? '启用' : '禁用' }}
              </span>
            </td>
            <td>{{ user.createdAt }}</td>
            <td class="actions">
              <button class="action-btn edit" @click="editUser(user)">编辑</button>
              <button class="action-btn delete" @click="deleteUser(user.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <button class="glass-btn" :disabled="currentPage === 1" @click="currentPage--">上一页</button>
      <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
      <button class="glass-btn" :disabled="currentPage === totalPages" @click="currentPage++">下一页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  status: number;
  createdAt: string;
}

const users = ref<User[]>([
  { id: 1, username: 'admin', email: 'admin@example.com', role: '超级管理员', status: 1, createdAt: '2024-01-15' },
  { id: 2, username: 'editor', email: 'editor@example.com', role: '编辑', status: 1, createdAt: '2024-02-20' },
  { id: 3, username: 'viewer', email: 'viewer@example.com', role: '访客', status: 0, createdAt: '2024-03-10' },
  { id: 4, username: 'manager', email: 'manager@example.com', role: '经理', status: 1, createdAt: '2024-04-05' },
  { id: 5, username: 'developer', email: 'dev@example.com', role: '开发者', status: 1, createdAt: '2024-05-12' }
]);

const searchKeyword = ref('');
const currentPage = ref(1);
const pageSize = ref(5);
const showAddDialog = ref(false);

const filteredUsers = computed(() => {
  if (!searchKeyword.value) return users.value;
  const keyword = searchKeyword.value.toLowerCase();
  return users.value.filter(u => 
    u.username.toLowerCase().includes(keyword) || 
    u.email.toLowerCase().includes(keyword)
  );
});

const totalPages = computed(() => Math.ceil(filteredUsers.value.length / pageSize.value));

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredUsers.value.slice(start, start + pageSize.value);
});

const handleSearch = () => {
  currentPage.value = 1;
  console.log('[Users] Search:', searchKeyword.value);
};

const resetSearch = () => {
  searchKeyword.value = '';
  currentPage.value = 1;
};

const editUser = (user: User) => {
  console.log('[Users] Edit user:', user);
};

const deleteUser = (id: number) => {
  if (confirm('确定要删除此用户吗?')) {
    users.value = users.value.filter(u => u.id !== id);
    console.log('[Users] Deleted user:', id);
  }
};

onMounted(() => {
  console.log('[Users] Page mounted, total users:', users.value.length);
});
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.users-page {
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

.search-bar {
  display: flex;
  gap: $spacing-sm;
  align-items: center;
}

.search-input {
  flex: 1;
  height: 40px;
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: $spacing-sm $spacing-md;
    text-align: left;
    color: rgba(255, 255, 255, 0.9);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  th {
    background: rgba(255, 255, 255, 0.05);
    font-weight: 600;
  }

  tr:hover td {
    background: rgba(255, 255, 255, 0.05);
  }
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;

  &.active {
    background: rgba(72, 187, 120, 0.2);
    color: #48bb78;
  }

  &.inactive {
    background: rgba(245, 101, 101, 0.2);
    color: #f56565;
  }
}

.actions {
  display: flex;
  gap: $spacing-sm;
}

.action-btn {
  padding: 4px 12px;
  border: none;
  border-radius: $radius-sm;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &.edit {
    background: rgba(102, 126, 234, 0.2);
    color: #667eea;

    &:hover { background: rgba(102, 126, 234, 0.3); }
  }

  &.delete {
    background: rgba(245, 101, 101, 0.2);
    color: #f56565;

    &:hover { background: rgba(245, 101, 101, 0.3); }
  }
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: $spacing-md;
  margin-top: $spacing-md;
}

.page-info {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}
</style>