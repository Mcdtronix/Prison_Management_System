import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PrisonLayout } from '@/components/PrisonLayout'
import { messagingApi } from '@/lib/api'

const ThreadView = () => {
  const { id } = useParams<{ id: string }>()
  const [thread, setThread] = useState<any | null>(null)
  const [body, setBody] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!id) return
      const res = await messagingApi.getThread(Number(id))
      if (res.data) setThread(res.data)
    }
    load()
  }, [id])

  const send = async () => {
    if (!thread) return
    await messagingApi.createMessage({ thread: thread.id, body })
    setBody('')
    const res = await messagingApi.getThread(thread.id)
    if (res.data) setThread(res.data)
  }

  const markRead = async () => {
    if (!thread) return
    await messagingApi.markThreadRead(thread.id)
  }

  return (
    <PrisonLayout title={thread ? thread.subject : 'Thread'} description="Thread details">
      <div className="p-4">
        {thread ? (
          <>
            <h3 className="text-lg font-semibold">{thread.subject}</h3>
            <div className="my-4">
              {thread.messages.map((m: any) => (
                <div key={m.id} className="mb-2 border-b pb-2">
                  <div className="text-sm text-gray-600">{m.created_at} — {m.sender && m.sender.mailbox_address}</div>
                  <div>{m.body}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full h-24 p-2 border" />
              <div className="flex gap-2 mt-2">
                <button onClick={send} className="btn btn-primary">Send</button>
                <button onClick={markRead} className="btn">Mark read</button>
              </div>
            </div>
          </>
        ) : (
          <p>Loading thread...</p>
        )}
      </div>
    </PrisonLayout>
  )
}

export default ThreadView
