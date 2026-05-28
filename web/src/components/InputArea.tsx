import React, { useState, useRef } from 'react';

interface InputAreaProps {
  onSend: (content: string) => void;
  isLoading: boolean;
  language: 'en' | 'zh';
  model: string;
}

const i18nMap: Record<string, { placeholder: string }> = {
  en: {
    placeholder: 'Ask anything, / for commands, @ for context...',
  },
  zh: {
    placeholder: '随便问点什么... "在整个代码库中添加日志"',
  },
};

const InputArea: React.FC<InputAreaProps> = ({ onSend, isLoading, language, model }) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = i18nMap[language] || i18nMap.en;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) {
        onSend(trimmed);
        setValue('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div id="input-area">
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          id="message-input"
          placeholder={t.placeholder}
          rows={1}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          type="button"
          id="send-btn"
          disabled={!value.trim() || isLoading}
          onClick={handleSend}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10.5 3.5L4 10l6.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="input-model-selector">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M3 4l4-2 4 2M3 10l4 2 4-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{model}</span>
      </div>
    </div>
  );
};

export default InputArea;
