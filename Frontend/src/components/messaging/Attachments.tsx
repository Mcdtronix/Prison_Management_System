/** File chips: files waiting to be sent, and files you can download. */
import { useRef } from 'react';
import { Download, FileImage, FileSpreadsheet, FileText, Paperclip, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatBytes, type AttachmentInfo, type MessagingConfig } from '@/lib/messaging';

const iconFor = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return FileImage;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  return FileText;
};

/** Paperclip button that checks files against the server's limits before adding them. */
export function AttachButton({ files, onChange, config }: {
  files: File[]; onChange: (f: File[]) => void; config: MessagingConfig | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const allowed = config?.allowed_extensions || [];

  const accept = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (allowed.length && !allowed.includes(ext)) {
        toast({ title: `${f.name} can't be attached`, description: `Allowed types: ${allowed.join(', ')}.`, variant: 'destructive' });
      } else if (config && f.size > config.max_attachment_bytes) {
        toast({ title: `${f.name} is too large`, description: `Files must be under ${formatBytes(config.max_attachment_bytes)}.`, variant: 'destructive' });
      } else if (config && next.length >= config.max_attachments) {
        toast({ title: 'Too many files', description: `Attach at most ${config.max_attachments} files to one message.`, variant: 'destructive' });
        break;
      } else next.push(f);
    }
    onChange(next);
  };

  return (
    <>
      <button type="button" onClick={() => input.current?.click()} title="Attach file" aria-label="Attach file"
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
        <Paperclip className="h-4 w-4" /> <span className="hidden sm:inline">Attach</span>
      </button>
      <input ref={input} type="file" multiple hidden accept={allowed.map((e) => `.${e}`).join(',')}
        onChange={(e) => { accept(e.target.files); e.target.value = ''; }} />
    </>
  );
}

export function PendingFiles({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => {
        const Icon = iconFor(f.name);
        return (
          <span key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-2 rounded-md border bg-muted/40 py-1 pl-2 pr-1 text-xs">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="max-w-[14rem] truncate">{f.name}</span>
            <span className="text-muted-foreground">{formatBytes(f.size)}</span>
            <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
          </span>
        );
      })}
    </div>
  );
}

export function SentFiles({ files }: { files: AttachmentInfo[] }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f) => {
        const Icon = iconFor(f.name);
        return (
          <a key={f.id} href={f.url} download={f.name} title={`Download ${f.name}`}
            className="group inline-flex max-w-full items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs hover:border-primary/40 hover:bg-muted">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="max-w-[16rem] truncate font-medium">{f.name}</span>
            <span className="text-muted-foreground">{formatBytes(f.size)}</span>
            <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
          </a>
        );
      })}
    </div>
  );
}
