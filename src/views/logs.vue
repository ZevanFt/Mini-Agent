<template>
  <div class="logs-page">
    <div class="page-header">
      <h2 class="page-title">系统日志</h2>
      <button class="glass-btn">清空日志</button>
    </div>
    <div class="log-filters glass-panel">
      <select v-model="logLevel" class="glass-input filter-select">
        <option value="">全部级别</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
      </select>
      <input v-model="logKeyword" class="glass-input search-input" placeholder="搜索日志..." />
    </div>
    <div class="log-list glass-panel">
      <div v-for="log in filteredLogs" :key="log.id" class="log-item" :class="log.level">
        <span class="log-time">{{ log.time }}</span>
        <span class="log-level-badge">{{ log.level.toUpperCase() }}</span>
        <span class="log-message">{{ log.message }}</span>
        <span class="log-source">{{ log.source }}</span>
      </div>
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

interface Log {
  id: number;
  time: string;
  level: string;
  message: string;
  source: string;
}

const logs = ref<Log[]>([
  { id: 1, time: '2024-05-20 10:30:00', level: 'info', message: '用户 admin 登录成功', source: 'Auth' },
  { id: 2, time: '2024-05-20 10:32:15', level: 'info', message: '创建新用户: editor', source: 'User' },
  { id: 3, time: '2024-05-20 10:35:42', level: 'warn', message: 'API 响应延迟超过 2s', source: 'API' },
  { id: 4, time: '2024-05-20 10:40:00', level: 'error', message: '数据库连接失败', source: 'Database' },
  { id: 5, time: '2024-05-20 10:45:23', level: 'info', message: '系统配置已更新', source: 'System' },
  { id: 6, time: '2024-05-20 11:00:00', level: 'info', message: '用户 editor 修改了个人资料', source: 'User' },
  { id: 7, time: '2024-05-20 11:15:30', level: 'warn', message: '磁盘空间不足 20%', source: 'System' }
]);

const logLevel = ref('');
const logKeyword = ref('');
const currentPage = ref(1);
const pageSize = 5;

const filteredLogs = computed(() => {
  let result = logs.value;
  if (logLevel.value) {
    result = result.filter(l => l.level === logLevel.value);
  }
  if (logKeyword.value) {
    const keyword = logKeyword.value.toLowerCase();
    result = result.filter(l => 
      l.message.toLowerCase().includes(keyword) || 
      l.source.toLowerCase().includes(keyword)
    );
  }
  const start = (currentPage.value - 1) * pageSize;
  return result.slice(start, start + pageSize);
});

const totalPages = computed(() => Math.ceil(logs.value.length / pageSize));

onMounted(() => {
  console.log('[Logs] Page mounted, total logs:', logs.value.length);
});
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.logs-page {
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

.log-filters {
  display: flex;
  gap: $spacing-sm;
}

.filter-select {
  height: 40px;
  min-width: 120px;
}

.search-input {
  flex: 1;
  height: 40px;
}

.log-list {
  padding: 0;
  max-height: 500px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
}

.log-time {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-family: monospace;
  min-width: 150px;
}

.log-level-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  min-width: 50px;
  text-align: center;
}

.log-item.info .log-level-badge { background: rgba(66, 153, 225, 0.2); color: #4299e1; }
.log-item.warn .log-level-badge { background: rgba(237, 137, 54, 0.2); color: #ed8936; }
.log-item.error .log-level-badge { background: rgba(245, 101, 101, 0.2); color: #f56565; }

.log-message {
  color: rgba(255, 255, 255, 0.8);
  flex: 1;
  font-size: 14px;
}

.log-source {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-family: monospace;
}
</style>