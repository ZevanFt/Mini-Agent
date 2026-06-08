import { useState, useCallback, useRef } from 'react';
import { ChatMessage, SessionUsage } from '../types';

const API_BASE = '/api';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usage, setUsage] = useState<SessionUsage>({ input: 0, output: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setMessages([]);
    setUsage({ input: 0, output: 0, total: 0 });
    setStreamContent('');
    setIsLoading(false);
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
      const data = await res.json();
      const msgs = data.messages || [];
      if (msgs.length > 0) {
        const chatMsgs: ChatMessage[] = msgs.map((m: any) => ({
          id: m.id,
          session_id: m.session_id,
          role: m.role,
          content: m.content,
          tool_calls: m.tool_calls,
          timestamp: m.created_at,
        }));
        setMessages(chatMsgs);

        let totalInput = 0, totalOutput = 0;
        chatMsgs.forEach(msg => {
          if (msg.role === 'assistant' && msg.tokens) {
            totalInput += msg.tokens.input || 0;
            totalOutput += msg.tokens.output || 0;
          }
        });
        setUsage({ input: totalInput, output: totalOutput, total: totalInput + totalOutput });
      } else {
        setMessages([]);
        setUsage({ input: 0, output: 0, total: 0 });
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    }
  }, []);

  const sendMessage = useCallback(async (sessionId: string, content: string, model = 'qwen2.5-coder:3b') => {
    if (!content.trim() || isLoading) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setStreamContent('');

    const userMsg: ChatMessage = { role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    const inputTokens = Math.ceil(content.length / 4);
    setUsage(prev => ({ ...prev, input: prev.input + inputTokens, total: prev.total + inputTokens }));

    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errData.error || 'Request failed'}`, timestamp: Date.now() }]);
        setIsLoading(false);
        setStreamContent('');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
            continue;
          }

          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            try {
              const parsed = JSON.parse(dataStr);

              if (currentEvent === 'chunk' && parsed.content) {
                fullContent += parsed.content;
                setStreamContent(fullContent);
              } else if (currentEvent === 'tool_call') {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Calling tool: ${parsed.name}`,
                  timestamp: Date.now(),
                }]);
              } else if (currentEvent === 'done') {
                const content = parsed.content || fullContent;
                setMessages(prev => [...prev, { role: 'assistant', content, timestamp: Date.now() }]);
                const outputTokens = Math.ceil(content.length / 4);
                setUsage(prev => ({ ...prev, output: prev.output + outputTokens, total: prev.total + outputTokens }));
                setStreamContent('');
              } else if (currentEvent === 'error') {
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${parsed.error || 'Stream error'}`, timestamp: Date.now() }]);
                setStreamContent('');
              }
            } catch {
              // parse error, skip
            } finally {
              currentEvent = 'message';
            }
          }
        }
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User aborted, don't show error
        return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to get response', timestamp: Date.now() }]);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
      setStreamContent('');
      abortRef.current = null;
    }
  }, [isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamContent('');
  }, []);

  return {
    messages,
    usage,
    isLoading,
    streamContent,
    sendMessage,
    loadMessages,
    reset,
    clearMessages,
  };
}
