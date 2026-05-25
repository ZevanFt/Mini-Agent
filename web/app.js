// MiniAgent Web UI - Complete App with Settings + i18n
const API_BASE = '/api';

let currentSessionId = null;
let sessions = [];
let isLoading = false;

// i18n translations
const i18n = {
  en: {
    logo_subtitle: 'Web Interface',
    new_session: 'New Session',
    connected: 'Connected',
    settings: 'Settings',
    welcome_subtitle: 'Your Local AI Coding Assistant',
    suggest_1: 'Explain the project structure',
    suggest_2: 'Help me write code',
    suggest_3: 'Setup development environment',
    suggest_4: 'Review my code',
    input_placeholder: 'Ask MiniAgent anything...',
    hint_send: 'to send',
    hint_newline: 'for new line',
    settings_title: 'Settings',
    section_general: 'General',
    setting_language: 'Language',
    setting_theme: 'Theme',
    theme_dark: 'Dark',
    theme_light: 'Light',
    setting_font_size: 'Font Size',
    section_model: 'Model',
    setting_model: 'Ollama Model',
    setting_ollama_url: 'Ollama URL',
    setting_temperature: 'Temperature',
    setting_max_tokens: 'Max Tokens',
    section_server: 'Server',
    setting_server_port: 'Server Port',
    setting_server_host: 'Server Host',
    host_local: 'Local (127.0.0.1)',
    host_all: 'All Interfaces (0.0.0.0)',
    section_tools: 'Tool Permissions',
    tool_bash: 'Bash Execution',
    tool_file_write: 'File Write',
    tool_web: 'Web Access',
    perm_allow: 'Allow',
    perm_ask: 'Ask',
    perm_deny: 'Deny',
    section_about: 'About',
    about_version: 'Version',
    about_engine: 'Engine',
    about_license: 'License',
    about_github: 'GitHub',
    save_settings: 'Save Settings',
    reset_defaults: 'Reset Defaults',
    settings_saved: 'Settings saved!',
    settings_reset: 'Settings reset to defaults',
    no_sessions: 'No sessions yet',
    messages_count: 'messages',
  },
  zh: {
    logo_subtitle: 'Web 界面',
    new_session: '新会话',
    connected: '已连接',
    settings: '设置',
    welcome_subtitle: '你的本地 AI 编程助手',
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
    setting_theme: '主题',
    theme_dark: '深色',
    theme_light: '浅色',
    setting_font_size: '字体大小',
    section_model: '模型',
    setting_model: 'Ollama 模型',
    setting_ollama_url: 'Ollama 地址',
    setting_temperature: '温度',
    setting_max_tokens: '最大 Token',
    section_server: '服务器',
    setting_server_port: '服务器端口',
    setting_server_host: '服务器地址',
    host_local: '本地 (127.0.0.1)',
    host_all: '所有接口 (0.0.0.0)',
    section_tools: '工具权限',
    tool_bash: 'Bash 执行',
    tool_file_write: '文件写入',
    tool_web: '网络访问',
    perm_allow: '允许',
    perm_ask: '询问',
    perm_deny: '禁止',
    section_about: '关于',
    about_version: '版本',
    about_engine: '引擎',
    about_license: '许可证',
    about_github: 'GitHub',
    save_settings: '保存设置',
    reset_defaults: '恢复默认',
    settings_saved: '设置已保存！',
    settings_reset: '设置已恢复默认',
    no_sessions: '暂无会话',
    messages_count: '条消息',
  }
};

// Default settings
const DEFAULT_SETTINGS = {
  language: 'en',
  theme: 'dark',
  fontSize: 14,
  model: 'qwen2.5:7b',
  ollamaUrl: 'http://localhost:11434',
  temperature: 0.7,
  maxTokens: 4096,
  serverPort: 3000,
  serverHost: '127.0.0.1',
  tools: {
    bash: 'allow',
    fileWrite: 'allow',
    web: 'allow',
  },
};

// Load settings
function loadSettings() {
  try {
    const saved = localStorage.getItem('miniagent-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// Save settings
function saveSettings(settings) {
  localStorage.setItem('miniagent-settings', JSON.stringify(settings));
}

// Current settings
let settings = loadSettings();

// DOM Elements
const sessionList = document.getElementById('session-list');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const newSessionBtn = document.getElementById('new-session-btn');
const chatForm = document.getElementById('chat-form');
const statusText = document.getElementById('status-text');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsBtn = document.getElementById('settings-btn');

// Initialize
async function init() {
  applySettings();
  await checkHealth();
  await loadSessions();
  setupEventListeners();
}

// Apply settings to UI
function applySettings() {
  // Theme
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.getElementById('setting-theme').value = settings.theme;

  // Language
  document.documentElement.lang = settings.language;
  document.getElementById('setting-language').value = settings.language;
  applyLanguage(settings.language);

  // Font size
  document.documentElement.style.setProperty('--font-size-base', `${settings.fontSize}px`);
  document.getElementById('setting-font-size').value = settings.fontSize;
  document.getElementById('font-size-value').textContent = `${settings.fontSize}px`;

  // Model
  document.getElementById('setting-model').value = settings.model;
  document.getElementById('setting-ollama-url').value = settings.ollamaUrl;

  // Temperature
  document.getElementById('setting-temperature').value = settings.temperature;
  document.getElementById('temperature-value').textContent = settings.temperature;

  // Max tokens
  document.getElementById('setting-max-tokens').value = settings.maxTokens;

  // Server
  document.getElementById('setting-server-port').value = settings.serverPort;
  document.getElementById('setting-server-host').value = settings.serverHost;

  // Tools
  document.getElementById('tool-bash').value = settings.tools.bash;
  document.getElementById('tool-file-write').value = settings.tools.fileWrite;
  document.getElementById('tool-web').value = settings.tools.web;
}

// Apply language translations
function applyLanguage(lang) {
  const t = i18n[lang] || i18n.en;

  // data-i18n attributes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  // data-i18n-placeholder attributes
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) {
      el.setAttribute('placeholder', t[key]);
    }
  });

  // data-i18n-title attributes
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key]) {
      el.setAttribute('title', t[key]);
    }
  });
}

// Health check
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      statusText.textContent = i18n[settings.language]?.connected || 'Connected';
      document.querySelector('.status-dot').style.background = 'var(--success)';
    } else {
      setStatus('Error', 'var(--error)');
    }
  } catch {
    setStatus('Disconnected', 'var(--error)');
  }
}

function setStatus(text, color) {
  statusText.textContent = text;
  document.querySelector('.status-dot').style.background = color;
}

// Load sessions
async function loadSessions() {
  try {
    const res = await fetch(`${API_BASE}/sessions`);
    const data = await res.json();
    sessions = data.sessions || [];
    renderSessions();
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
}

// Render session list
function renderSessions() {
  sessionList.innerHTML = '';
  const t = i18n[settings.language] || i18n.en;

  if (sessions.length === 0) {
    sessionList.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
        ${t.no_sessions}
      </div>
    `;
    return;
  }

  sessions.forEach(session => {
    const div = document.createElement('div');
    div.className = `session-item ${session.id === currentSessionId ? 'active' : ''}`;
    div.innerHTML = `
      <div class="session-title">${escapeHtml(session.title || 'New Session')}</div>
      <div class="session-meta">${session.message_count || 0} ${t.messages_count}</div>
    `;
    div.addEventListener('click', () => switchSession(session.id));
    sessionList.appendChild(div);
  });
}

// Create new session
async function createSession() {
  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Session' }),
    });
    const session = await res.json();
    currentSessionId = session.id;
    await loadSessions();
    clearMessages();
    showWelcome();
    messageInput.focus();
  } catch (err) {
    console.error('Failed to create session:', err);
  }
}

// Switch session
async function switchSession(sessionId) {
  currentSessionId = sessionId;
  renderSessions();
  await loadSessionMessages(sessionId);
}

// Load session messages
async function loadSessionMessages(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    const session = await res.json();

    clearMessages();

    if (session.messages && session.messages.length > 0) {
      hideWelcome();
      session.messages.forEach(msg => addMessage(msg.role, msg.content, false));
    } else {
      showWelcome();
    }
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

// Send message
async function sendMessage(content) {
  if (!content.trim() || isLoading) return;
  if (!currentSessionId) {
    await createSession();
  }

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
      addMessage('assistant', data.content || '(No response - Ollama not running)');
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

// Add message to chat
function addMessage(role, content, animate = true) {
  const div = document.createElement('div');
  div.className = `message message-${role}`;
  if (!animate) div.style.animation = 'none';

  const roleLabel = role === 'user' ? (settings.language === 'zh' ? '你' : 'You') : 'MiniAgent';

  div.innerHTML = `
    <div class="message-role">${roleLabel}</div>
    <div class="message-content">${formatContent(content)}</div>
  `;

  messagesContainer.appendChild(div);
  return div;
}

// Add loading indicator
function addLoading() {
  const thinkingText = settings.language === 'zh' ? 'MiniAgent 正在思考' : 'MiniAgent is thinking';
  const div = document.createElement('div');
  div.className = 'loading';
  div.innerHTML = `
    <span>${thinkingText}</span>
    <div class="loading-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  messagesContainer.appendChild(div);
  scrollToBottom();
  return div;
}

// Clear messages
function clearMessages() {
  messagesContainer.innerHTML = '';
}

// Show welcome screen
function showWelcome() {
  const t = i18n[settings.language] || i18n.en;
  if (!messagesContainer.querySelector('.welcome-screen')) {
    messagesContainer.innerHTML = `
      <div class="welcome-screen">
        <div class="welcome-content">
          <h1>MiniAgent</h1>
          <p class="welcome-subtitle">${t.welcome_subtitle}</p>
          <div class="suggestions">
            <button class="suggestion-btn" data-prompt="Explain the project structure">
              📂 ${t.suggest_1}
            </button>
            <button class="suggestion-btn" data-prompt="Help me write a TypeScript function">
              💻 ${t.suggest_2}
            </button>
            <button class="suggestion-btn" data-prompt="How do I set up the development environment?">
              🛠️ ${t.suggest_3}
            </button>
            <button class="suggestion-btn" data-prompt="Review my code and suggest improvements">
              🔍 ${t.suggest_4}
            </button>
          </div>
        </div>
      </div>
    `;
    attachSuggestionListeners();
  }
}

// Hide welcome screen
function hideWelcome() {
  const welcome = messagesContainer.querySelector('.welcome-screen');
  if (welcome) welcome.remove();
}

// Format content
function formatContent(content) {
  let html = escapeHtml(content);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Scroll to bottom
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Setup event listeners
function setupEventListeners() {
  // New session button
  newSessionBtn.addEventListener('click', createSession);

  // Chat form submission
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (content) {
      await sendMessage(content);
    }
  });

  // Message input handling
  messageInput.addEventListener('input', () => {
    sendBtn.disabled = !messageInput.value.trim();
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = messageInput.value.trim();
      if (content) {
        sendMessage(content);
      }
    }
  });

  // Settings open/close
  settingsBtn.addEventListener('click', () => {
    settingsOverlay.hidden = false;
  });

  settingsCloseBtn.addEventListener('click', () => {
    settingsOverlay.hidden = true;
  });

  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) {
      settingsOverlay.hidden = true;
    }
  });

  // Settings: Language change
  document.getElementById('setting-language').addEventListener('change', (e) => {
    settings.language = e.target.value;
    applyLanguage(settings.language);
  });

  // Settings: Theme change
  document.getElementById('setting-theme').addEventListener('change', (e) => {
    settings.theme = e.target.value;
    document.documentElement.setAttribute('data-theme', settings.theme);
  });

  // Settings: Font size change
  document.getElementById('setting-font-size').addEventListener('input', (e) => {
    settings.fontSize = parseInt(e.target.value, 10);
    document.documentElement.style.setProperty('--font-size-base', `${settings.fontSize}px`);
    document.getElementById('font-size-value').textContent = `${settings.fontSize}px`;
  });

  // Settings: Temperature change
  document.getElementById('setting-temperature').addEventListener('input', (e) => {
    settings.temperature = parseFloat(e.target.value);
    document.getElementById('temperature-value').textContent = settings.temperature;
  });

  // Settings: Save
  document.getElementById('settings-save-btn').addEventListener('click', () => {
    settings.model = document.getElementById('setting-model').value;
    settings.ollamaUrl = document.getElementById('setting-ollama-url').value;
    settings.maxTokens = parseInt(document.getElementById('setting-max-tokens').value, 10);
    settings.serverPort = parseInt(document.getElementById('setting-server-port').value, 10);
    settings.serverHost = document.getElementById('setting-server-host').value;
    settings.tools.bash = document.getElementById('tool-bash').value;
    settings.tools.fileWrite = document.getElementById('tool-file-write').value;
    settings.tools.web = document.getElementById('tool-web').value;

    saveSettings(settings);

    const t = i18n[settings.language] || i18n.en;
    alert(t.settings_saved);
    settingsOverlay.hidden = true;
  });

  // Settings: Reset
  document.getElementById('settings-reset-btn').addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) {
      settings = { ...DEFAULT_SETTINGS };
      saveSettings(settings);
      applySettings();
      const t = i18n[settings.language] || i18n.en;
      alert(t.settings_reset);
    }
  });

  // Suggestion buttons
  attachSuggestionListeners();
}

// Attach suggestion button listeners
function attachSuggestionListeners() {
  document.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt) {
        sendMessage(prompt);
      }
    });
  });
}

// Initialize app
init().catch(console.error);
