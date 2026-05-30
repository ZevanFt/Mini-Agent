<template>
  <div class="login-container">
    <div class="login-card glass-panel">
      <div class="login-header">
        <h1 class="login-title">⚡ Admin Pro</h1>
        <p class="login-subtitle">欢迎回来，请登录您的账户</p>
      </div>
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input
            v-model="form.username"
            class="glass-input form-input"
            type="text"
            placeholder="请输入用户名"
            required
          />
        </div>
        <div class="form-group">
          <label class="form-label">密码</label>
          <input
            v-model="form.password"
            class="glass-input form-input"
            type="password"
            placeholder="请输入密码"
            required
          />
        </div>
        <button type="submit" class="glass-btn login-btn">
          登录
        </button>
      </form>
      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/store/app';

const router = useRouter();
const appStore = useAppStore();

const form = ref({ username: 'admin', password: 'admin123' });
const errorMsg = ref('');

const handleLogin = async () => {
  console.log('[Login] Attempting login:', form.value);
  
  if (form.value.username === 'admin' && form.value.password === 'admin123') {
    appStore.setToken('mock-token-' + Date.now());
    console.log('[Login] Login successful');
    router.push('/dashboard');
  } else {
    errorMsg.value = '用户名或密码错误';
    console.error('[Login] Login failed: Invalid credentials');
  }
};
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg;
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: $spacing-xl;
}

.login-header {
  text-align: center;
  margin-bottom: $spacing-xl;
}

.login-title {
  font-size: 28px;
  color: #fff;
  margin-bottom: $spacing-sm;
}

.login-subtitle {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.form-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 44px;
  font-size: 14px;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 600;
  margin-top: $spacing-sm;
}

.error-msg {
  color: $danger;
  text-align: center;
  margin-top: $spacing-sm;
  font-size: 14px;
}
</style>