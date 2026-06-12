import api from './index'

export const listMailboxes = () => api.get('/api/messaging/mailboxes/')
export const listThreads = () => api.get('/api/messaging/threads/')
export const getThread = (id: number) => api.get(`/api/messaging/threads/${id}/`)
export const createThread = (payload: any) => api.post('/api/messaging/threads/', payload)
export const listMessages = () => api.get('/api/messaging/messages/')
export const createMessage = (payload: any) => api.post('/api/messaging/messages/', payload)
export const markThreadRead = (id: number) => api.post(`/api/messaging/threads/${id}/mark_read/`)

export default {
  listMailboxes,
  listThreads,
  getThread,
  createThread,
  listMessages,
  createMessage,
  markThreadRead,
}
