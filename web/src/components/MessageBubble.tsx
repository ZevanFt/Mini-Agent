import React from 'react';

interface MessageBubbleProps {
  role: string;
  content: string;
  language: 'en' | 'zh';
  isStreaming?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, language, isStreaming }) => {
  const roleLabel = role === 'user' ? (language === 'zh' ? '你' : 'You') : 'MiniAgent';

  return (
    <div className={`message message-${role}`}>
      <div className="message-inner">
        <div className="message-role">{roleLabel}</div>
        <div className="message-content" dangerouslySetInnerHTML={{ __html: formatContent(content) }} />
      </div>
    </div>
  );
};

function formatContent(content: string): string {
  let html = escapeHtml(content);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default MessageBubble;
