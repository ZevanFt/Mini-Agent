import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import WelcomeScreen from './WelcomeScreen';

interface ChatAreaProps {
  messages: any[];
  streamContent: string;
  isLoading: boolean;
  language: 'en' | 'zh';
  onSuggestion: (prompt: string) => void;
  model: string;
}

const ChatArea: React.FC<ChatAreaProps> = ({ messages, streamContent, isLoading, language, onSuggestion, model }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0 || streamContent.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  const t = language === 'zh'
    ? { thinking: 'MiniAgent 正在思考' }
    : { thinking: 'MiniAgent is thinking' };

  return (
    <div id="chat-container">
      <div id="messages">
        {!hasMessages ? (
          <WelcomeScreen
            onSend={onSuggestion}
            onProjectClick={() => {}}
            language={language}
            model={model}
            selectedProject={null}
          />
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id || `msg-${i}`}
                role={msg.role}
                content={msg.content}
              />
            ))}
            {streamContent && (
              <MessageBubble role="assistant" content={streamContent} />
            )}
            {isLoading && !streamContent && (
              <div className="loading">
                <span>{t.thinking}</span>
                <div className="loading-dots">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  );
};

export default ChatArea;
