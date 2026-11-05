/** Edit your signature: formatted text added to new messages and replies. */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, mail, type SignatureInfo } from '@/lib/messaging';
import { RichTextEditor, type RichTextEditorHandle } from './RichTextEditor';

export function SignatureDialog({ open, onOpenChange, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (s: SignatureInfo) => void;
}) {
  const { toast } = useToast();
  const editor = useRef<RichTextEditorHandle>(null);
  const [loaded, setLoaded] = useState<SignatureInfo | null>(null);
  const [autoInsert, setAutoInsert] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setLoaded(null); return; }
    mail.signature().then((res) => {
      const s = res.data || { body_html: '', auto_insert: true, updated_at: null };
      setLoaded(s);
      setAutoInsert(s.auto_insert);
    });
  }, [open]);

  const save = async () => {
    setSaving(true);
    const res = await mail.saveSignature({ body_html: editor.current?.getHTML() || '', auto_insert: autoInsert });
    setSaving(false);
    if (res.error || !res.data) {
      toast({ title: 'Signature not saved', description: friendlyError(res.error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Signature saved' });
    onSaved?.(res.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Signature</DialogTitle>
          <DialogDescription>Your name, rank and contact details, added below new messages and replies.</DialogDescription>
        </DialogHeader>
        {loaded ? (
          <RichTextEditor ref={editor} compact minHeight={140} initialHtml={loaded.body_html}
            placeholder="e.g. Insp. A. Moyo, Officer in Charge, Reception, Chivhu Prison" />
        ) : (
          <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        )}
        <div className="flex items-center gap-3">
          <Switch id="sig-auto" checked={autoInsert} onCheckedChange={setAutoInsert} />
          <Label htmlFor="sig-auto">Add my signature automatically</Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!loaded || saving}>{saving ? 'Saving…' : 'Save signature'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** HTML to start a new message or reply with: blank lines, then the signature. */
export const withSignature = (signature: SignatureInfo | null) =>
  signature?.auto_insert && signature.body_html ? `<p></p><p></p>${signature.body_html}` : '';
