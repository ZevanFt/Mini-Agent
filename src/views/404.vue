<template>
  <div class="not-found">
    <div class="not-found-content glass-panel">
      <h1 class="error-code">404</h1>
      <p class="error-message">页面未找到</p>
      <p class="error-desc">您访问的页面不存在或已被移除</p>
      <button class="glass-btn" @click="$router.push('/dashboard')">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
console.log('[404] Not found page loaded');
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg;
}

.not-found-content {
  text-align: center;
  padding: $spacing-xl * 2;
}

.error-code {
  font-size: 120px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
  margin-bottom: $spacing-md;
}

.error-message {
  font-size: 24px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: $spacing-sm;
}

.error-desc {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: $spacing-lg;
}
</style>