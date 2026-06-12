import React from 'react'
import { PrisonLayout } from '@/components/PrisonLayout'

const Drafts = () => {
  return (
    <PrisonLayout title="Drafts" description="Saved drafts">
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-2">Drafts</h2>
        <p className="text-sm text-gray-600">Drafts are available in the mailbox view. This view will list drafts saved for your mailbox.</p>
      </div>
    </PrisonLayout>
  )
}

export default Drafts
