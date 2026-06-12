import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { messagingApi } from '@/lib/api'
import { PrisonLayout } from '@/components/PrisonLayout'

export default function Compose() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [recipients, setRecipients] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const navigate = useNavigate()
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!query) return setSuggestions([])
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      const res = await messagingApi.listMailboxes()
      if (res.data) {
        // Basic client-side filter
        const q = query.toLowerCase()
        setSuggestions((res.data as any[]).filter(m => m.mailbox_address.toLowerCase().includes(q)))
      }
    }, 250)
  }, [query])

  const addRecipient = (addr: string) => {
    if (!recipients.includes(addr)) setRecipients([...recipients, addr])
    setQuery('')
    setSuggestions([])
  }

  const removeRecipient = (addr: string) => {
    setRecipients(recipients.filter(r => r !== addr))
  }

  const onFiles = (fList: FileList | null) => {
    if (!fList) return
    setFiles([...files, ...Array.from(fList)])
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onFiles(e.dataTransfer.files)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (recipients.length === 0) {
      alert('Add at least one recipient')
      return
    }

    const form = new FormData()
    form.append('subject', subject)
    form.append('initial_body', body)
    form.append('participants', recipients.join(','))
    files.forEach(f => form.append('attachments', f))

    const res = await messagingApi.createThread(form)
    if (res.data && (res.data as any).id) {
      navigate(`/messaging/threads/${(res.data as any).id}`)
    } else {
      alert(res.error || 'Failed to create thread')
    }
  }

  return (
    <PrisonLayout title="Compose" description="Write a new message">
      <div className="max-w-3xl mx-auto p-4">
        <h2 className="text-xl font-semibold mb-4">Compose Message</h2>
        <form onSubmit={onSubmit}>
        <label className="block mb-2">To</label>
        <div className="border rounded p-2 mb-2" onDrop={onDrop} onDragOver={(e)=>e.preventDefault()}>
          <div className="flex flex-wrap gap-2 mb-2">
            {recipients.map(r => (
              <div key={r} className="bg-gray-100 px-2 py-1 rounded flex items-center gap-2">
                <span>{r}</span>
                <button type="button" onClick={() => removeRecipient(r)} className="text-red-500">×</button>
              </div>
            ))}
          </div>

          <input
            className="w-full px-2 py-1"
            placeholder="Type mailbox address to search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          {suggestions.length > 0 && (
            <ul className="border mt-1 bg-white max-h-48 overflow-auto">
              {suggestions.map(s => (
                <li key={s.id} className="p-2 hover:bg-gray-50 cursor-pointer" onClick={() => addRecipient(s.mailbox_address)}>
                  <div className="font-medium">{s.mailbox_address}</div>
                  <div className="text-xs text-gray-500">{s.org_unit_department?.org_unit?.name || ''}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block mb-2">Subject</label>
        <input className="w-full border rounded px-2 py-1 mb-4" value={subject} onChange={e => setSubject(e.target.value)} />

        <label className="block mb-2">Message</label>
        <textarea className="w-full border rounded px-2 py-2 mb-4 h-40" value={body} onChange={e => setBody(e.target.value)} />

        <label className="block mb-2">Attachments (drag & drop or browse)</label>
        <input type="file" multiple onChange={e => onFiles(e.target.files)} />
        {files.length > 0 && (
          <ul className="mt-2">
            {files.map((f, i) => (
              <li key={i} className="text-sm">{f.name} — {(f.size/1024).toFixed(1)} KB</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex gap-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Send</button>
          <button type="button" className="border px-4 py-2 rounded" onClick={() => { setSubject(''); setBody(''); setFiles([]); setRecipients([]) }}>Clear</button>
        </div>
        </form>
      </div>
    </PrisonLayout>
  )
}
