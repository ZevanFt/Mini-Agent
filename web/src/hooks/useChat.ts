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
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
      const session = await res.json();
      if (session.messages && session.messages.length > 0) {
        const msgs: ChatMessage[] = session.messages.map((m: any) => ({
          id: m.id,
          session_id: m.session_id,
          role: m.role,
          content: m.content,
          tool_calls: m.tool_calls,
          timestamp: m.created_at,
        }));
        setMessages(msgs);

        let totalInput = 0, totalOutput = 0;
        msgs.forEach(msg => {
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const parsed = JSON.parse(dataStr);

              if (parsed.event === 'chunk' && parsed.data) {
                const chunk = JSON.parse(parsed.data);
                if (chunk.content) {
                  fullContent += chunk.content;
                  setStreamContent(fullContent);
                }
              } else if (parsed.event === 'done') {
                const doneData = JSON.parse(parsed.data);
                setMessages(prev => [...prev, { role: 'assistant', content: doneData.content || fullContent, timestamp: Date.now() }]);
                const outputTokens = Math.ceil((doneData.content || fullContent).length / 4);
                setUsage(prev => ({ ...prev, output: prev.output + outputTokens, total: prev.total + outputTokens }));
                setStreamContent('');
              } else if (parsed.event === 'error') {
                const errData = JSON.parse(parsed.data);
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errData.error || 'Stream error'}`, timestamp: Date.now() }]);
                setStreamContent('');
              }
            } catch {
              // parse error, skip
            }
          }
        }
      }

      // If stream ended without 'done' event but has content
      if (fullContent && !messages.some(m => m.role === 'assistant' && m.content === fullContent)) {
        // Check if assistant msg was already added
        const existingAssistant = messages.find(m => m.role === 'assistant' && m.content === fullContent);
        if (!existingAssistant) {
          // Already handled in done event
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
  }, [isLoading, messages]);

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
