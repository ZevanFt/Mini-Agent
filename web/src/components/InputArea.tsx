import React, { useState, useRef } from 'react';

interface InputAreaProps {
  onSend: (content: string) => void;
  isLoading: boolean;
  language: 'en' | 'zh';
}

const i18nMap: Record<string, { placeholder: string; hint_send: string; hint_newline: string }> = {
  en: {
    placeholder: 'Ask MiniAgent...',
    hint_send: 'to send',
    hint_newline: 'newline',
  },
  zh: {
    placeholder: '问 MiniAgent 任何问题...',
    hint_send: '发送',
    hint_newline: '换行',
  },
};

const InputArea: React.FC<InputAreaProps> = ({ onSend, isLoading, language }) => {
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
        <span className="input-prompt">{'>'}</span>
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
            <path d="M3.5 8h9M9.5 5.5l2.5 2.5-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="input-hint">
        <kbd>Enter</kbd> {t.hint_send} · <kbd>Shift+Enter</kbd> {t.hint_newline}
      </div>
    </div>
  );
};

export default InputArea;
