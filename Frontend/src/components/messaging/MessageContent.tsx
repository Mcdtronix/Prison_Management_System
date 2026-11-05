/**
 * Shows a message body. The server has already cleaned it; DOMPurify cleans it
 * again in the browser, so a server bug alone can never run script here.
 */
import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';
import './messaging.css';

const purifier = DOMPurify();
purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
  }
  if (node.tagName === 'IMG') {
    node.setAttribute('loading', 'lazy');
    node.setAttribute('referrerpolicy', 'no-referrer');
  }
});

export function MessageContent({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => purifier.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'svg', 'math'],
    FORBID_ATTR: ['class', 'id'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  }), [html]);
  return <div className={cn('pms-prose', className)} dangerouslySetInnerHTML={{ __html: safe }} />;
}
