import React from 'react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Link, useLocation } from 'react-router-dom';
import { Inbox, Send, FileText, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { messagingApi } from '@/lib/api';

interface MailLayoutProps {
  children: React.ReactNode;
  title: string;
}

const MailLayout: React.FC<MailLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = React.useState<number>(0);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const res = await messagingApi.getUnreadCount();
      if (!mounted) return;
      if (res && typeof res.data === 'number') setUnreadCount(res.data);
    };

    load();
    const id = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const navItems = [
    { label: 'Inbox', icon: <Inbox size={18} />, href: '/messaging/inbox' },
    { label: 'Sent', icon: <Send size={18} />, href: '/messaging/outbox' },
    { label: 'Drafts', icon: <FileText size={18} />, href: '/messaging/drafts' },
  ];

  return (
    <PrisonLayout title={title} description="Organizational Messaging">
      <div className="flex h-[calc(100vh-140px)] bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="w-64 bg-white border-r flex flex-col">
          <div className="p-4">
            <Button className="w-full justify-start rounded-lg shadow-sm bg-gray-900 hover:bg-gray-800 text-white" size="lg" asChild>
              <Link to="/messaging/compose">
                <Edit3 className="mr-2 h-4 w-4" />
                Compose
              </Link>
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto mt-2">
            
            {/* Folders Section */}
            <div className="mb-6">
              <h3 className="px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Folders</h3>
              <nav className="space-y-0.5 px-2">
                {[
                  { label: 'Inbox', icon: <Inbox size={16} />, href: '/messaging/inbox', count: unreadCount },
                  { label: 'Sent', icon: <Send size={16} />, href: '/messaging/outbox', count: 0 }
                ].map((item) => {
                  const isActive = location.pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-[14px] transition-colors ${
                        isActive
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        {item.label}
                      </div>
                      {item.count > 0 && (
                        <span className={`text-xs font-semibold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                          {item.count > 99 ? '99+' : item.count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Others Section */}
            <div className="mb-6">
              <h3 className="px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Others</h3>
              <nav className="space-y-0.5 px-2">
                {[
                  { label: 'Drafts', icon: <FileText size={16} />, href: '/messaging/drafts' }
                ].map((item) => {
                  const isActive = location.pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-[14px] transition-colors ${
                        isActive
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </PrisonLayout>
  );
};

export default MailLayout;
