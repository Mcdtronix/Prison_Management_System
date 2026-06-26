import React from 'react';
import MailLayout from './MailLayout';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreVertical, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Drafts = () => {
  return (
    <MailLayout title="Drafts">
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="h-14 border-b flex items-center px-4 gap-4 bg-white shrink-0">
          <Checkbox className="mr-2" />
          <Button variant="ghost" size="icon" title="Refresh">
            <RefreshCw className="h-4 w-4 text-gray-600" />
          </Button>
          <Button variant="ghost" size="icon" title="More">
            <MoreVertical className="h-4 w-4 text-gray-600" />
          </Button>
        </div>

        {/* Message List Placeholder */}
        <div className="flex-1 overflow-y-auto bg-white flex items-center justify-center">
          <div className="text-center p-8">
            <p className="text-gray-500 font-medium text-lg">You don't have any saved drafts.</p>
            <p className="text-sm text-gray-400 mt-2">Saving drafts will let you keep messages you aren't ready to send.</p>
          </div>
        </div>
      </div>
    </MailLayout>
  );
};

export default Drafts;
