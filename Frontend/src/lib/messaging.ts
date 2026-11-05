/**
 * Messaging API client and types. Mirrors Messaging/views.py.
 *
 * Files and pictures come back as short-lived signed links, so they can be
 * used directly in <a href> and <img src> without the login token.
 */
import { apiRequest, type ApiResponse } from './api';

export type Folder = 'inbox' | 'sent' | 'starred' | 'archived' | 'trash';
export type Importance = 'LOW' | 'NORMAL' | 'HIGH';

export interface MailboxBrief {
  id: number;
  address: string;
  department: string;
  unit: string;
  unit_type: string;
}

export interface DirectoryEntry {
  id: number;
  mailbox_address: string;
  department_name: string;
  org_unit_name: string;
  unit_type: string;
}

export interface AttachmentInfo {
  id: number;
  name: string;
  size: number;
  content_type: string;
  url: string;
}

export interface MessageItem {
  id: number;
  thread: number;
  sender: MailboxBrief | null;
  sent_by_name: string | null;
  body: string;
  body_html: string;
  importance: Importance;
  created_at: string;
  attachments: AttachmentInfo[];
  is_mine: boolean;
}

export interface ThreadSummary {
  id: number;
  subject: string;
  participants: MailboxBrief[];
  last_message_at: string | null;
  snippet: string;
  last_sender: MailboxBrief | null;
  message_count: number;
  unread_count: number;
  starred: boolean;
  archived: boolean;
  trashed: boolean;
  important: boolean;
  has_attachments: boolean;
}

export interface ThreadDetail {
  id: number;
  subject: string;
  created_at: string;
  last_message_at: string | null;
  participants: MailboxBrief[];
  messages: MessageItem[];
  starred: boolean;
  archived: boolean;
  trashed: boolean;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DraftItem {
  id: number;
  recipients: string[];
  subject: string;
  body_html: string;
  importance: Importance;
  created_at: string;
  updated_at: string;
}

export interface SignatureInfo {
  body_html: string;
  auto_insert: boolean;
  updated_at: string | null;
}

export interface MessagingConfig {
  mailbox: MailboxBrief | null;
  max_attachments: number;
  max_attachment_bytes: number;
  max_inline_image_bytes: number;
  allowed_extensions: string[];
  grammar_enabled: boolean;
}

export interface GrammarMatch {
  offset: number;
  length: number;
  message: string;
  short: string;
  replacements: string[];
  category: string;
}

export interface ThreadStateChange {
  starred?: boolean;
  archived?: boolean;
  trashed?: boolean;
  read?: boolean;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

/** Server errors arrive as "field: message"; people only need the message. */
export const friendlyError = (error?: string, fallback = 'Something went wrong. Please try again.') =>
  (error || fallback).replace(/^[a-z_]+: /, '');

const qs = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const mail = {
  config: () => apiRequest<MessagingConfig>('/messaging/config/'),

  folder: (folder: Folder, params: { q?: string; page?: number } = {}) =>
    apiRequest<Page<ThreadSummary>>(`/messaging/threads/${qs({ folder, ...params })}`),

  thread: (id: number | string, markRead = true) =>
    apiRequest<ThreadDetail>(`/messaging/threads/${id}/${markRead ? '' : '?mark_read=0'}`),

  setState: (id: number, change: ThreadStateChange) =>
    apiRequest(`/messaging/threads/${id}/state/`, { method: 'POST', ...json(change) }),

  setStateMany: (ids: number[], change: ThreadStateChange) =>
    apiRequest<{ updated: number }>('/messaging/threads/state/', { method: 'POST', ...json({ ids, ...change }) }),

  /** Start a conversation. Files go under `attachments`. */
  start: (fields: {
    subject: string; recipients: string[]; bodyHtml: string; importance: Importance;
    files: File[]; draftId?: number | null;
  }) => {
    const form = new FormData();
    form.append('subject', fields.subject);
    form.append('participants', fields.recipients.join(','));
    form.append('body_html', fields.bodyHtml);
    form.append('importance', fields.importance);
    if (fields.draftId) form.append('draft_id', String(fields.draftId));
    fields.files.forEach((f) => form.append('attachments', f));
    return apiRequest<ThreadDetail>('/messaging/threads/', { method: 'POST', body: form });
  },

  reply: (threadId: number, fields: { bodyHtml: string; importance: Importance; files: File[] }) => {
    const form = new FormData();
    form.append('thread', String(threadId));
    form.append('body_html', fields.bodyHtml);
    form.append('importance', fields.importance);
    fields.files.forEach((f) => form.append('attachments', f));
    return apiRequest<MessageItem>('/messaging/messages/', { method: 'POST', body: form });
  },

  directory: (q: string) =>
    apiRequest<Page<DirectoryEntry>>(`/messaging/mailboxes/${qs({ q: q.trim(), page_size: 20 })}`),

  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<{ id: string; url: string }>('/messaging/inline-images/', { method: 'POST', body: form });
  },

  drafts: () => apiRequest<Page<DraftItem>>('/messaging/drafts/'),
  draft: (id: number | string) => apiRequest<DraftItem>(`/messaging/drafts/${id}/`),
  saveDraft: (id: number | null, fields: Partial<Pick<DraftItem, 'recipients' | 'subject' | 'body_html' | 'importance'>>) =>
    id
      ? apiRequest<DraftItem>(`/messaging/drafts/${id}/`, { method: 'PATCH', ...json(fields) })
      : apiRequest<DraftItem>('/messaging/drafts/', { method: 'POST', ...json(fields) }),
  deleteDraft: (id: number) => apiRequest(`/messaging/drafts/${id}/`, { method: 'DELETE' }),

  signature: () => apiRequest<SignatureInfo>('/messaging/signature/'),
  saveSignature: (fields: Partial<Pick<SignatureInfo, 'body_html' | 'auto_insert'>>) =>
    apiRequest<SignatureInfo>('/messaging/signature/', { method: 'PUT', ...json(fields) }),

  grammar: (text: string) =>
    apiRequest<{ matches: GrammarMatch[] }>('/messaging/grammar/', { method: 'POST', ...json({ text }) }),

  unreadCount: async (): Promise<ApiResponse<number>> => {
    const res = await apiRequest<{ count: number }>('/messaging/unread_count/');
    return { data: res.data?.count ?? 0, status: res.status, error: res.error };
  },
};

// ------------------------------------------------------------------ display helpers

export const describeMailbox = (m: MailboxBrief | null | undefined) =>
  m ? `${m.department} · ${m.unit}` : 'Unknown sender';

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

/** "14:05" today, "3 Nov" this year, "3 Nov 2025" otherwise. */
export const shortDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
};

export const longDate = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const FOLDERS: { key: Folder; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'starred', label: 'Starred' },
  { key: 'sent', label: 'Sent' },
  { key: 'archived', label: 'Archive' },
  { key: 'trash', label: 'Trash' },
];
