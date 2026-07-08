import React from 'react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Link, useLocation } from 'react-router-dom';
import { Inbox, Send, FileText, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MailLayoutProps {
  children: React.ReactNode;
  title: string;
}

const MailLayout: React.FC<MailLayoutProps> = ({ children, title }) => {
  const location = useLocation();

  const navItems = [
    { label: 'Inbox', icon: <Inbox size={18} />, href: '/messaging/inbox' },
    { label: 'Sent', icon: <Send size={18} />, href: '/messaging/outbox' },
    { label: 'Drafts', icon: <FileText size={18} />, href: '/messaging/drafts' },
  ];

  return (
    <PrisonLayout title={title} description="Organizational Messaging">
      <div className="flex h-[calc(100vh-140px)] bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-gray-50 border-r flex flex-col">
          <div className="p-4">
            <Button className="w-full justify-start rounded-full shadow-sm" size="lg" asChild>
              <Link to="/messaging/compose">
                <Edit3 className="mr-2 h-5 w-5" />
                Compose
              </Link>
            </Button>
          </div>
          <nav className="flex-1 px-2 space-y-1 mt-2">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-r-full mr-4 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#d7a928]/20 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
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
