import React from 'react';
import { X, Cpu, Shield, Zap, Globe } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
  language: 'en' | 'zh';
}

const i18nMap: Record<string, Record<string, string>> = {
  en: {
    title: 'About MiniAgent',
    version: 'Version',
    description: 'A local AI Agent framework — runs on your machine with Ollama, no cloud needed.',
    features: 'Key Features',
    local_first: '100% Local',
    local_first_desc: 'All AI processing happens locally via Ollama, your data never leaves your machine.',
    agentic: 'Agentic Workflow',
    agentic_desc: 'Built-in tools, code execution, and autonomous task completion pipeline.',
    real_time: 'Real-time Streaming',
    real_time_desc: 'SSE-based streaming for instant responses with minimal latency.',
    multi_ui: 'Dual Interface',
    multi_ui_desc: 'Both terminal (TUI) and web UI — use what works best for you.',
    close: 'Close',
    github: 'GitHub',
    tech_stack: 'Tech Stack',
    tech_stack_desc: 'Built with Bun, TypeScript, React, and Vite for maximum performance.',
  },
  zh: {
    title: '关于 MiniAgent',
    version: '版本',
    description: '本地 AI Agent 框架 — 通过 Ollama 在你的机器上运行，无需云端。',
    features: '核心特性',
    local_first: '100% 本地',
    local_first_desc: '所有 AI 处理都通过 Ollama 在本地完成，数据不会离开你的设备。',
    agentic: 'Agent 工作流',
    agentic_desc: '内置工具、代码执行和自主任务完成流水线。',
    real_time: '实时流式响应',
    real_time_desc: '基于 SSE 的流式响应，低延迟即时反馈。',
    multi_ui: '双界面支持',
    multi_ui_desc: '同时支持终端 (TUI) 和 Web 界面 — 选择最适合你的方式。',
    close: '关闭',
    github: 'GitHub',
    tech_stack: '技术栈',
    tech_stack_desc: '使用 Bun、TypeScript、React 和 Vite 构建，追求极致性能。',
  },
};

const AboutModal: React.FC<AboutModalProps> = ({ onClose, language }) => {
  const t = i18nMap[language] || i18nMap.en;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-panel" onClick={e => e.stopPropagation()}>
        <div className="about-header">
          <div className="about-title-row">
            <h2>{t.title}</h2>
            <button className="about-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="about-version">
            {t.version} 1.0.0
          </div>
        </div>

        <div className="about-body">
          <p className="about-description">{t.description}</p>

          <div className="about-section">
            <h3 className="about-section-title">{t.features}</h3>
            <div className="about-features">
              <div className="about-feature-item">
                <div className="about-feature-icon">
                  <Shield size={20} />
                </div>
                <div className="about-feature-text">
                  <div className="about-feature-name">{t.local_first}</div>
                  <div className="about-feature-desc">{t.local_first_desc}</div>
                </div>
              </div>
              <div className="about-feature-item">
                <div className="about-feature-icon">
                  <Cpu size={20} />
                </div>
                <div className="about-feature-text">
                  <div className="about-feature-name">{t.agentic}</div>
                  <div className="about-feature-desc">{t.agentic_desc}</div>
                </div>
              </div>
              <div className="about-feature-item">
                <div className="about-feature-icon">
                  <Zap size={20} />
                </div>
                <div className="about-feature-text">
                  <div className="about-feature-name">{t.real_time}</div>
                  <div className="about-feature-desc">{t.real_time_desc}</div>
                </div>
              </div>
              <div className="about-feature-item">
                <div className="about-feature-icon">
                  <Globe size={20} />
                </div>
                <div className="about-feature-text">
                  <div className="about-feature-name">{t.multi_ui}</div>
                  <div className="about-feature-desc">{t.multi_ui_desc}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h3 className="about-section-title">{t.tech_stack}</h3>
            <p className="about-tech-desc">{t.tech_stack_desc}</p>
            <div className="about-tech-tags">
              <span className="about-tech-tag">Bun</span>
              <span className="about-tech-tag">TypeScript</span>
              <span className="about-tech-tag">React 18</span>
              <span className="about-tech-tag">Vite 5</span>
              <span className="about-tech-tag">Ollama</span>
              <span className="about-tech-tag">SQLite</span>
              <span className="about-tech-tag">Express</span>
              <span className="about-tech-tag">SSE</span>
            </div>
          </div>
        </div>

        <div className="about-footer">
          <button className="about-btn-close" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
