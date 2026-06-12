import React, { useEffect, useState } from 'react'
import { PrisonLayout } from '@/components/PrisonLayout'
import { messagingApi } from '@/lib/api'
import { Link } from 'react-router-dom'

const Inbox = () => {
  const [threads, setThreads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await messagingApi.listThreads()
      if (res.data) {
        if (Array.isArray(res.data)) {
          setThreads(res.data)
        } else if ((res.data as any).results && Array.isArray((res.data as any).results)) {
          setThreads((res.data as any).results)
        } else {
          setThreads([])
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <PrisonLayout title="Inbox" description="Organizational messaging inbox">
      <div className="p-4">
        <div className="mb-4">
          <Link to="/messaging/compose" className="bg-green-600 text-white px-3 py-1 rounded">Compose</Link>
        </div>
        <h2 className="text-xl font-semibold mb-2">Threads</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {threads.map((t) => (
              <li key={t.id} className="py-2">
                <Link to={`/messaging/threads/${t.id}`} className="text-blue-600 hover:underline">
                  {t.subject} — {t.created_at}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PrisonLayout>
  )
}

export default Inbox
