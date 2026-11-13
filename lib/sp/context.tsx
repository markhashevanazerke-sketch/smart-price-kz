'use client';
// SMART PRICE — global client context: language, current user (role), demo mode.

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SPLanguage, t } from './i18n';
import { User, Role } from './types';

export interface SPUser extends User {
  entries_count?: number;
  reviews_count?: number;
}

interface SPContextType {
  lang: SPLanguage;
  setLang: (l: SPLanguage) => void;
  tr: (key: string) => string;
  users: SPUser[];
  currentUser: SPUser | null;
  setCurrentUserId: (id: string) => void;
  refreshUsers: () => Promise<void>;
  demoRunning: boolean;
  setDemoRunning: (v: boolean) => void;
  demoStep: number;
  setDemoStep: (n: number) => void;
  unread: number;
  setUnread: (n: number) => void;
}

const SPContext = createContext<SPContextType | undefined>(undefined);

export function SPProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SPLanguage>('ru');
  const [users, setUsers] = useState<SPUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [unread, setUnread] = useState(0);

  const setLang = useCallback((l: SPLanguage) => {
    setLangState(l);
    try { localStorage.setItem('sp_lang', l); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sp_lang') as SPLanguage | null;
      if (saved && ['kk', 'ru', 'en'].includes(saved)) setLangState(saved);
    } catch { /* ignore */ }
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const r = await fetch('/api/sp/users');
      if (r.ok) {
        const list: SPUser[] = await r.json();
        setUsers(list);
        setCurrentUserId(prev => {
          if (prev && list.some(u => u.id === prev)) return prev;
          const defaultUser = list.find(u => u.role === 'specialist') || list[0];
          return defaultUser?.id || '';
        });
      }
    } catch { /* offline */ }
    try {
      const r2 = await fetch('/api/sp/notifications');
      if (r2.ok) {
        const j = await r2.json();
        setUnread(j.unread || 0);
      }
    } catch { /* offline */ }
  }, []);

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  const currentUser = users.find(u => u.id === currentUserId) || null;
  const tr = useCallback((key: string) => t(key, lang), [lang]);

  // expose current user globally for spFetch headers
  useEffect(() => {
    (window as any).__spCurrentUser = currentUser;
  }, [currentUser]);

  return (
    <SPContext.Provider value={{
      lang, setLang, tr,
      users, currentUser,
      setCurrentUserId,
      refreshUsers,
      demoRunning, setDemoRunning,
      demoStep, setDemoStep,
      unread, setUnread,
    }}>
      {children}
    </SPContext.Provider>
  );
}

export function useSP() {
  const ctx = useContext(SPContext);
  if (!ctx) throw new Error('useSP must be used within SPProvider');
  return ctx;
}

/** Fetch wrapper carrying the current user/role headers (RBAC on the API side). */
export async function spFetch(path: string, init: RequestInit = {}) {
  let user: SPUser | null = null;
  try {
    // read from a global set by the provider on each render
    user = (window as any).__spCurrentUser || null;
  } catch { /* ignore */ }
  const headers: Record<string, string> = {
    ...(init.headers as any),
    'x-user-name': encodeURIComponent(user?.name || 'Гость'),
    'x-user-role': (user?.role as Role) || 'specialist',
  };
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...init, headers });
  let data: any = null;
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const e: any = new Error(msg);
    e.status = res.status;
    e.details = data?.details;
    throw e;
  }
  return data;
}
