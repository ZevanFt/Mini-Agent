<template>
  <div class="settings-page">
    <h2 class="page-title">个人设置</h2>
    <div class="settings-grid">
      <div class="settings-card glass-panel">
        <h3 class="card-title">基本信息</h3>
        <form class="settings-form" @submit.prevent="saveProfile">
          <div class="form-group">
            <label class="form-label">头像</label>
            <div class="avatar-preview">👤</div>
          </div>
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input v-model="profile.username" class="glass-input form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input v-model="profile.email" class="glass-input form-input" type="email" />
          </div>
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input v-model="profile.phone" class="glass-input form-input" />
          </div>
          <button type="submit" class="glass-btn save-btn">保存修改</button>
        </form>
      </div>
      <div class="settings-card glass-panel">
        <h3 class="card-title">修改密码</h3>
        <form class="settings-form" @submit.prevent="changePassword">
          <div class="form-group">
            <label class="form-label">当前密码</label>
            <input v-model="passwordForm.current" class="glass-input form-input" type="password" />
          </div>
          <div class="form-group">
            <label class="form-label">新密码</label>
            <input v-model="passwordForm.new" class="glass-input form-input" type="password" />
          </div>
          <div class="form-group">
            <label class="form-label">确认新密码</label>
            <input v-model="passwordForm.confirm" class="glass-input form-input" type="password" />
          </div>
          <button type="submit" class="glass-btn save-btn">修改密码</button>
        </form>
      </div>
      <div class="settings-card glass-panel">
        <h3 class="card-title">偏好设置</h3>
        <div class="pref-list">
          <div class="pref-item">
            <span class="pref-label">侧边栏折叠</span>
            <button class="toggle" :class="{ active: appStore.sidebarCollapsed }" @click="appStore.toggleSidebar">
              {{ appStore.sidebarCollapsed ? '开' : '关' }}
            </button>
          </div>
          <div class="pref-item">
            <span class="pref-label">主题</span>
            <select v-model="appStore.theme" class="glass-input pref-select">
              <option value="light">明亮</option>
              <option value="dark">暗黑</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppStore } from '@/store/app';

const appStore = useAppStore();

const profile = ref({
  username: 'admin',
  email: 'admin@example.com',
  phone: '13800138000'
});

const passwordForm = ref({
  current: '',
  new: '',
  confirm: ''
});

const saveProfile = () => {
  console.log('[Settings] Saving profile:', profile.value);
  alert('个人资料已保存!');
};

const changePassword = () => {
  console.log('[Settings] Changing password');
  if (passwordForm.value.new !== passwordForm.value.confirm) {
    alert('两次输入的密码不一致!');
    return;
  }
  alert('密码修改成功!');
  passwordForm.value = { current: '', new: '', confirm: '' };
};

onMounted(() => {
  console.log('[Settings] Page mounted');
});
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.settings-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.page-title {
  color: #fff;
  font-size: 20px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: $spacing-lg;
}

.settings-card {
  padding: $spacing-lg;
}

.card-title {
  color: #fff;
  font-size: 16px;
  margin-bottom: $spacing-md;
  padding-bottom: $spacing-sm;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-form {
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
}

.form-input {
  width: 100%;
  height: 40px;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
}

.save-btn {
  width: 100%;
  height: 40px;
  margin-top: $spacing-sm;
}

.pref-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.pref-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pref-label {
  color: rgba(255, 255, 255, 0.8);
}

.toggle {
  padding: $spacing-xs $spacing-sm;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  border-radius: $radius-sm;
  cursor: pointer;
  min-width: 50px;

  &.active {
    background: rgba(102, 126, 234, 0.3);
    color: #667eea;
  }
}

.pref-select {
  height: 36px;
  min-width: 120px;
}
</style>