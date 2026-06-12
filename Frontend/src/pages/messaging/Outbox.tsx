import React, { useEffect, useState } from 'react'
import { PrisonLayout } from '@/components/PrisonLayout'
import { messagingApi } from '@/lib/api'
import { Link } from 'react-router-dom'

const Outbox = () => {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await messagingApi.listMessages()
      if (res.data) {
        if (Array.isArray(res.data)) setMessages(res.data)
        else if ((res.data as any).results && Array.isArray((res.data as any).results)) setMessages((res.data as any).results)
        else setMessages([])
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <PrisonLayout title="Outbox" description="Messages you have sent">
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-2">Outbox</h2>
        {loading ? <p>Loading...</p> : (
          <ul>
            {messages.map(m => (
              <li key={m.id} className="py-2">
                <Link to={`/messaging/threads/${m.thread}`} className="text-blue-600 hover:underline">{m.body?.slice(0,80) || 'Message'} — {m.created_at}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PrisonLayout>
  )
}

export default Outbox
