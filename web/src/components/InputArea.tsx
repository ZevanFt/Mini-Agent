import React, { useState, useRef } from 'react';
import { Send, Cpu } from 'lucide-react';

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
          <Send size={16} />
        </button>
      </div>
      <div className="input-model-selector">
        <Cpu size={14} />
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{model}</span>
      </div>
    </div>
  );
};

export default InputArea;
