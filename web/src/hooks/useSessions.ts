import { useState, useEffect, useCallback } from 'react';
import { Session } from '../types';

const API_BASE = '/api';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    }
  }, []);

  const createSession = useCallback(async (title = 'New Session') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const session: Session = await res.json();
      setCurrentSessionId(session.id);
      await loadSessions();
      return session;
    } catch (err) {
      console.error('Failed to create session:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadSessions]);

  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [currentSessionId]);

  return {
    sessions,
    currentSessionId,
    loading,
    loadSessions,
    createSession,
    switchSession,
    deleteSession,
    setCurrentSessionId,
  };
}
