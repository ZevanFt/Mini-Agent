// MiniAgent Web UI — TUI-style redesign
const API_BASE = '/api';

let currentSessionId = null;
let sessions = [];
let isLoading = false;
let sessionUsage = { input: 0, output: 0, total: 0 };

const i18n = {
  en: {
    logo_subtitle: 'Local AI Dev',
    new_session: 'New Session',
    connected: 'Connected',
    settings: 'Settings',
    welcome_subtitle: 'Your Local AI Coding Assistant — Ollama powered, zero cost',
    suggest_1: 'Explain the project structure',
    suggest_2: 'Help me write code',
    suggest_3: 'Setup dev environment',
    suggest_4: 'Review my code',
    input_placeholder: 'Ask MiniAgent...',
    hint_send: 'to send',
    hint_newline: 'newline',
    settings_title: 'Settings',
    section_general: 'General',
    setting_language: 'Language',
    setting_font_size: 'Font Size',
    section_model: 'Model',
    setting_model: 'Ollama Model',
    setting_temperature: 'Temperature',
    setting_max_tokens: 'Max Tokens',
    section_tools: 'Tool Permissions',
    tool_bash: 'Bash Execution',
    tool_file_write: 'File Write',
    perm_allow: 'Allow',
    perm_ask: 'Ask',
    perm_deny: 'Deny',
    section_about: 'About',
    about_version: 'Version',
    about_github: 'GitHub',
    save_settings: 'Save',
    reset_defaults: 'Reset',
    settings_saved: 'Settings saved!',
    settings_reset: 'Settings reset to defaults',
    no_sessions: 'No sessions yet',
    messages_count: 'msgs',
    sessions_label: 'Sessions',
    no_session: 'No session',
    thinking_en: 'MiniAgent is thinking',
    thinking_zh: 'MiniAgent 正在思考',
  },
  zh: {
    logo_subtitle: '本地 AI 开发',
    new_session: '新会话',
    connected: '已连接',
    settings: '设置',
    welcome_subtitle: '你的本地 AI 编程助手 — Ollama 驱动，零成本',
    suggest_1: '解释项目结构',
    suggest_2: '帮我写代码',
    suggest_3: '配置开发环境',
    suggest_4: '审查我的代码',
    input_placeholder: '问 MiniAgent 任何问题...',
    hint_send: '发送',
    hint_newline: '换行',
    settings_title: '设置',
    section_general: '通用',
    setting_language: '语言',
    setting_font_size: '字体大小',
    section_model: '模型',
    setting_model: 'Ollama 模型',
    setting_temperature: '温度',
    setting_max_tokens: '最大 Token',
    section_tools: '工具权限',
    tool_bash: 'Bash 执行',
    tool_file_write: '文件写入',
    perm_allow: '允许',
    perm_ask: '询问',
    perm_deny: '禁止',
    section_about: '关于',
    about_version: '版本',
    about_github: 'GitHub',
    save_settings: '保存',
    reset_defaults: '恢复默认',
    settings_saved: '设置已保存！',
    settings_reset: '设置已恢复默认',
    no_sessions: '暂无会话',
    messages_count: '条消息',
    sessions_label: '会话',
    no_session: '无会话',
    thinking_en: 'MiniAgent is thinking',
    thinking_zh: 'MiniAgent 正在思考',
  }
};

const DEFAULT_SETTINGS = {
  language: 'en',
  fontSize: 13,
  model: 'qwen2.5-coder:3b',
  temperature: 0.7,
  maxTokens: 4096,
  tools: { bash: 'allow', fileWrite: 'allow' },
};

function loadSettings() {
  try {
    const saved = localStorage.getItem('miniagent-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(settings) {
  localStorage.setItem('miniagent-settings', JSON.stringify(settings));
}

let settings = loadSettings();

// DOM refs
const sessionList = document.getElementById('session-list');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const newSessionBtn = document.getElementById('new-session-btn');
const statusText = document.getElementById('status-text');
const settingsOverlay = document.getElementById('settings-overlay');
const welcomeScreen = document.getElementById('welcome-screen');
const modelNameEl = document.getElementById('model-name');
const sessionTitleBar = document.getElementById('session-title-bar');
const contextTokensEl = document.getElementById('context-tokens');
const contextPercentEl = document.getElementById('context-percent');
const usageRingFill = document.getElementById('usage-ring-fill');
const tokenBreakdown = document.getElementById('token-breakdown');
const tokensInput = document.getElementById('tokens-input');
const tokensOutput = document.getElementById('tokens-output');
const tokensTotal = document.getElementById('tokens-total');
const contextModelName = document.getElementById('context-model-name');
const statusbarTokens = document.getElementById('statusbar-tokens');
const statusbarCost = document.getElementById('statusbar-cost');

async function init() {
  applySettings();
  await checkHealth();
  await loadSessions();
  setupEventListeners();
  contextModelName.textContent = settings.model;
}

function applySettings() {
  document.documentElement.lang = settings.language;
  applyLanguage(settings.language);
  document.body.style.fontSize = `${settings.fontSize}px`;
  document.getElementById('setting-font-size').value = settings.fontSize;
  document.getElementById('font-size-value').textContent = `${settings.fontSize}px`;
  document.getElementById('setting-model').value = settings.model;
  document.getElementById('setting-temperature').value = settings.temperature;
  document.getElementById('temperature-value').textContent = settings.temperature;
  document.getElementById('setting-max-tokens').value = settings.maxTokens;
  document.getElementById('tool-bash').value = settings.tools.bash;
  document.getElementById('tool-file-write').value = settings.tools.fileWrite;
  modelNameEl.textContent = settings.model;
}

function applyLanguage(lang) {
  const t = i18n[lang] || i18n.en;
  document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (t[key]) el.textContent = t[key]; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const key = el.getAttribute('data-i18n-placeholder'); if (t[key]) el.setAttribute('placeholder', t[key]); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { const key = el.getAttribute('data-i18n-title'); if (t[key]) el.setAttribute('title', t[key]); });
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      statusText.textContent = i18n[settings.language]?.connected || 'Connected';
      document.querySelector('.status-dot').style.background = '#22c55e';
    } else { setStatus('Error', '#ef4444'); }
  } catch { setStatus('Disconnected', '#ef4444'); }
}

function setStatus(text, color) {
  statusText.textContent = text;
  document.querySelector('.status-dot').style.background = color;
}

async function loadSessions() {
  try {
    const res = await fetch(`${API_BASE}/sessions`);
    const data = await res.json();
    sessions = data.sessions || [];
    renderSessions();
  } catch { /* ignore */ }
}

function renderSessions() {
  sessionList.innerHTML = '';
  const t = i18n[settings.language] || i18n.en;
  if (sessions.length === 0) {
    sessionList.innerHTML = `<div style="padding:16px;text-align:center;color:#52525b;font-size:11px;">${t.no_sessions}</div>`;
    return;
  }
  sessions.forEach(session => {
    const div = document.createElement('div');
    div.className = `session-item ${session.id === currentSessionId ? 'active' : ''}`;
    div.innerHTML = `<div class="session-title">${escapeHtml(session.title || 'New Session')}</div><div class="session-meta">${session.message_count || 0} ${t.messages_count}</div>`;
    div.addEventListener('click', () => switchSession(session.id));
    sessionList.appendChild(div);
  });
}

async function createSession() {
  try {
    const res = await fetch(`${API_BASE}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Session' }) });
    const session = await res.json();
    currentSessionId = session.id;
    sessionTitleBar.textContent = session.title || 'New Session';
    resetUsage();
    await loadSessions();
    clearMessages();
    showWelcome();
    messageInput.focus();
  } catch (err) { console.error('Failed to create session:', err); }
}

async function switchSession(sessionId) {
  currentSessionId = sessionId;
  const session = sessions.find(s => s.id === sessionId);
  if (session) sessionTitleBar.textContent = session.title || 'New Session';
  resetUsage();
  renderSessions();
  await loadSessionMessages(sessionId);
}

async function loadSessionMessages(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    const session = await res.json();
    clearMessages();
    if (session.messages && session.messages.length > 0) {
      hideWelcome();
      let totalInput = 0, totalOutput = 0;
      session.messages.forEach(msg => {
        addMessage(msg.role, msg.content, false);
        if (msg.role === 'assistant' && msg.tokens) {
          totalInput += (msg.tokens.input || 0);
          totalOutput += (msg.tokens.output || 0);
        }
      });
      sessionUsage.input = totalInput;
      sessionUsage.output = totalOutput;
      sessionUsage.total = totalInput + totalOutput;
      updateUsageDisplay();
    } else { showWelcome(); }
  } catch (err) { console.error('Failed to load messages:', err); }
}

async function sendMessage(content) {
  if (!content.trim() || isLoading) return;
  if (!currentSessionId) await createSession();

  isLoading = true;
  sendBtn.disabled = true;
  messageInput.value = '';
  messageInput.style.height = 'auto';
  hideWelcome();

  addMessage('user', content);
  scrollToBottom();

  const loadingDiv = addLoading();

  try {
    const res = await fetch(`${API_BASE}/sessions/${currentSessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content }),
    });

    const data = await res.json();
    loadingDiv.remove();

    if (data.error) {
      addMessage('assistant', `Error: ${data.error}`);
    } else {
      const assistantContent = data.content || '(No response)';
      addMessage('assistant', assistantContent);

      // Estimate tokens (rough: ~4 chars per token)
      const inputTokens = Math.ceil(content.length / 4);
      const outputTokens = Math.ceil((data.content || '').length / 4);
      sessionUsage.input += inputTokens;
      sessionUsage.output += outputTokens;
      sessionUsage.total = sessionUsage.input + sessionUsage.output;
      updateUsageDisplay();
    }

    scrollToBottom();
    await loadSessions();
  } catch (err) {
    loadingDiv.remove();
    addMessage('assistant', 'Error: Failed to get response');
    console.error('Failed to send message:', err);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function addMessage(role, content, animate = true) {
  const msg = document.createElement('div');
  msg.className = `message message-${role}`;
  if (!animate) msg.style.animation = 'none';

  const t = i18n[settings.language] || i18n.en;
  const roleLabel = role === 'user' ? (settings.language === 'zh' ? '你' : 'You') : 'MiniAgent';

  msg.innerHTML = `<div class="message-inner"><div class="message-role">${roleLabel}</div><div class="message-content">${formatContent(content)}</div></div>`;
  messagesContainer.appendChild(msg);
  return msg;
}

function addLoading() {
  const t = i18n[settings.language] || i18n.en;
  const div = document.createElement('div');
  div.className = 'loading';
  div.innerHTML = `<span>${settings.language === 'zh' ? t.thinking_zh : t.thinking_en}</span><div class="loading-dots"><span></span><span></span><span></span></div>`;
  messagesContainer.appendChild(div);
  scrollToBottom();
  return div;
}

function clearMessages() { messagesContainer.innerHTML = ''; }

function showWelcome() {
  if (!messagesContainer.querySelector('.welcome-screen')) {
    messagesContainer.appendChild(welcomeScreen);
  }
}

function hideWelcome() {
  const w = messagesContainer.querySelector('.welcome-screen');
  if (w) w.remove();
}

function formatContent(content) {
  let html = escapeHtml(content);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() { messagesContainer.scrollTop = messagesContainer.scrollHeight; }

// Usage display
function resetUsage() {
  sessionUsage = { input: 0, output: 0, total: 0 };
  updateUsageDisplay();
}

function updateUsageDisplay() {
  const total = sessionUsage.total;
  const ctxLimit = 32768; // qwen2.5-coder:3b context limit
  const percent = Math.min(100, Math.round((total / ctxLimit) * 100));

  // Context panel
  contextTokensEl.textContent = total.toLocaleString();
  contextPercentEl.textContent = `${percent}%`;

  // Ring
  const circumference = 2 * Math.PI * 20; // r=20
  const offset = circumference - (percent / 100) * circumference;
  usageRingFill.style.strokeDashoffset = offset;

  // Breakdown (show when there's data)
  if (total > 0) {
    tokenBreakdown.style.display = 'block';
    tokensInput.textContent = sessionUsage.input.toLocaleString();
    tokensOutput.textContent = sessionUsage.output.toLocaleString();
    tokensTotal.textContent = total.toLocaleString();
  } else {
    tokenBreakdown.style.display = 'none';
  }

  // Status bar
  statusbarTokens.textContent = total > 0 ? `${total.toLocaleString()} tokens` : '—';
  statusbarCost.textContent = '$0.00'; // local model = free
}

function setupEventListeners() {
  newSessionBtn.addEventListener('click', createSession);

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const c = messageInput.value.trim(); if (c) sendMessage(c); }
  });

  messageInput.addEventListener('input', () => {
    sendBtn.disabled = !messageInput.value.trim();
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  });

  sendBtn.addEventListener('click', () => { const c = messageInput.value.trim(); if (c) sendMessage(c); });

  settingsBtn.addEventListener('click', () => { settingsOverlay.hidden = false; });
  settingsCloseBtn.addEventListener('click', () => { settingsOverlay.hidden = true; });
  settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) settingsOverlay.hidden = true; });

  document.getElementById('setting-language').addEventListener('change', (e) => { settings.language = e.target.value; applyLanguage(settings.language); });
  document.getElementById('setting-font-size').addEventListener('input', (e) => { settings.fontSize = parseInt(e.target.value, 10); document.body.style.fontSize = `${settings.fontSize}px`; document.getElementById('font-size-value').textContent = `${settings.fontSize}px`; });
  document.getElementById('setting-model').addEventListener('change', (e) => { settings.model = e.target.value; modelNameEl.textContent = settings.model; contextModelName.textContent = settings.model; });
  document.getElementById('setting-temperature').addEventListener('input', (e) => { settings.temperature = parseFloat(e.target.value); document.getElementById('temperature-value').textContent = settings.temperature; });

  document.getElementById('settings-save-btn').addEventListener('click', () => {
    settings.model = document.getElementById('setting-model').value;
    settings.maxTokens = parseInt(document.getElementById('setting-max-tokens').value, 10);
    settings.tools.bash = document.getElementById('tool-bash').value;
    settings.tools.fileWrite = document.getElementById('tool-file-write').value;
    saveSettings(settings);
    modelNameEl.textContent = settings.model;
    contextModelName.textContent = settings.model;
    const t = i18n[settings.language] || i18n.en;
    alert(t.settings_saved);
    settingsOverlay.hidden = true;
  });

  document.getElementById('settings-reset-btn').addEventListener('click', () => {
    if (confirm('Reset all settings?')) {
      settings = { ...DEFAULT_SETTINGS };
      saveSettings(settings);
      applySettings();
      const t = i18n[settings.language] || i18n.en;
      alert(t.settings_reset);
    }
  });

  // Suggestion buttons
  document.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => { const p = btn.dataset.prompt; if (p) sendMessage(p); });
  });
}

init().catch(console.error);
