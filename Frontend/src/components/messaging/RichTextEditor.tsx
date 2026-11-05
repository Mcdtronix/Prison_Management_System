/**
 * The message editor: an Outlook-style toolbar over TipTap.
 *
 * Runs entirely in the browser from the app's own bundle. Pictures upload to
 * this server only (POST /messaging/inline-images/). Whatever the editor
 * produces is cleaned again by the server before it is stored.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, Highlighter, ImagePlus, IndentDecrease,
  IndentIncrease, Italic, Link2, List, ListOrdered, Quote, Redo2, RemoveFormatting, SpellCheck, Strikethrough,
  Subscript as SubIcon, Superscript as SupIcon, Table as TableIcon, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { friendlyError, mail } from '@/lib/messaging';
import { ClearFormatting, FontSize, Indent, tidyPastedHtml } from './editorExtensions';
import { EmojiPicker } from './EmojiPicker';
import { GrammarPanel } from './GrammarPanel';
import './messaging.css';

/** TipTap's isEmpty only looks at text; a picture or table on its own is content too. */
const isBlank = (e: Editor) => e.isEmpty && !/<(img|table|hr)/i.test(e.getHTML());

export interface RichTextEditorHandle {
  editor: Editor | null;
  getHTML: () => string;
  isEmpty: () => boolean;
  setHTML: (html: string) => void;
  focus: () => void;
}

interface Props {
  initialHtml?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  /** Extra buttons at the end of the toolbar (e.g. Attach file). */
  toolbarEnd?: ReactNode;
  minHeight?: number;
  autoFocus?: boolean;
  grammarEnabled?: boolean;
  /** Smaller toolbar (signature editor). */
  compact?: boolean;
  /** Ctrl/Cmd+Enter. */
  onSubmitShortcut?: () => void;
  className?: string;
}

const FONTS = [
  { label: 'Default font', value: '' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Carlito, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];
const SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt'];
const TEXT_COLOURS = ['#000000', '#444444', '#777777', '#c00000', '#e06666', '#e69138', '#bf9000',
  '#38761d', '#0b4f2a', '#1155cc', '#0b5394', '#674ea7', '#a64d79', '#d7a928'];
const HIGHLIGHTS = ['#fff2a8', '#ffe599', '#d9ead3', '#b6d7a8', '#cfe2f3', '#a4c2f4', '#f4cccc', '#ead1dc', '#fce5cd'];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

function ToolButton({ label, shortcut, active, disabled, onClick, children }: {
  label: string; shortcut?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}
      aria-label={label} aria-pressed={active} title={shortcut ? `${label} (${shortcut})` : label}
      className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-primary/10 text-primary dark:bg-[#d7a928]/15 dark:text-[#d7a928]')}>
      {children}
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" />;

const selectClass = 'h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

function Swatches({ colours, onPick, onClear, clearLabel }: {
  colours: string[]; onPick: (c: string) => void; onClear: () => void; clearLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5">
        {colours.map((c) => (
          <button key={c} type="button" onClick={() => onPick(c)} aria-label={c} title={c}
            className="h-6 w-6 rounded border border-black/10 transition-transform hover:scale-110" style={{ backgroundColor: c }} />
        ))}
      </div>
      <button type="button" onClick={onClear} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-muted">{clearLabel}</button>
    </div>
  );
}

function normaliseUrl(raw: string) {
  const v = raw.trim();
  if (!v) return '';
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v)) return `https://${v}`;
  return null; // anything else (javascript:, relative paths...) is refused
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor({
  initialHtml = '', placeholder = 'Write your message…', onChange, toolbarEnd, minHeight = 220,
  autoFocus = false, grammarEnabled = false, compact = false, onSubmitShortcut, className,
}, ref) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [grammarOpen, setGrammarOpen] = useState(false);
  const submitRef = useRef(onSubmitShortcut);
  submitRef.current = onSubmitShortcut;
  const openLinkRef = useRef<() => void>(() => {});

  const uploadImages = async (files: File[], editorInstance: Editor | null) => {
    for (const file of files) {
      setUploading((n) => n + 1);
      const res = await mail.uploadImage(file);
      setUploading((n) => n - 1);
      if (res.error || !res.data) {
        toast({ title: `Could not add ${file.name}`, description: friendlyError(res.error), variant: 'destructive' });
        continue;
      }
      editorInstance?.chain().focus().setImage({ src: res.data.url, alt: file.name }).run();
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline, Subscript, Superscript, TextStyle, Color, FontFamily, FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto'] }),
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder }),
      Indent, ClearFormatting,
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: 'pms-prose px-4 py-3 focus:outline-none',
        spellcheck: 'true',
        lang: 'en-GB',
        'aria-label': 'Message text',
        'aria-multiline': 'true',
        role: 'textbox',
      },
      transformPastedHTML: tidyPastedHtml,
      handlePaste: (_view, event) => {
        const images = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
        if (!images.length) return false;
        uploadImages(images, editorRef.current);
        return true;
      },
      handleDrop: (_view, event) => {
        const images = Array.from((event as DragEvent).dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
        if (!images.length) return false;
        event.preventDefault();
        uploadImages(images, editorRef.current);
        return true;
      },
      handleKeyDown: (_view, event) => {
        const mod = event.ctrlKey || event.metaKey;
        if (mod && event.key === 'Enter' && submitRef.current) {
          event.preventDefault();
          submitRef.current();
          return true;
        }
        if (mod && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          openLinkRef.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(isBlank(e) ? '' : e.getHTML()),
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // TipTap's own autofocus can fire before the editor is on screen; do it once it is.
  useEffect(() => {
    if (!autoFocus || !editor) return;
    const t = window.setTimeout(() => { editor.commands.focus('start'); editor.view.focus(); }, 0);
    return () => window.clearTimeout(t);
  }, [autoFocus, editor]);

  useImperativeHandle(ref, () => ({
    editor,
    getHTML: () => (editor && !isBlank(editor) ? editor.getHTML() : ''),
    isEmpty: () => !editor || isBlank(editor),
    setHTML: (html: string) => editor?.commands.setContent(html, false),
    focus: () => { editor?.commands.focus('end'); editor?.view.focus(); },
  }), [editor]);

  if (!editor) return null;
  // Every toolbar command hands the keyboard straight back to the text, so typing
  // right after a menu choice (table, emoji, colour) lands where the cursor is.
  const chain = () => {
    const c = editor.chain().focus();
    const run = c.run;
    c.run = () => { const ok = run(); editor.view.focus(); return ok; };
    return c;
  };
  // Give the keyboard back to the text right away (TipTap's focus() waits for the next frame).
  const backToText = (e: Event) => { e.preventDefault(); editor.view.focus(); };

  const blockStyle = editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
      : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p';
  const setBlockStyle = (v: string) => {
    if (v === 'p') chain().setParagraph().run();
    else chain().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
  };
  const fontFamily = editor.getAttributes('textStyle').fontFamily || '';
  const fontSize = editor.getAttributes('textStyle').fontSize || '';

  const openLink = () => {
    setLinkValue(editor.getAttributes('link').href || '');
    setLinkOpen(true);
  };
  openLinkRef.current = openLink;
  const applyLink = () => {
    const url = normaliseUrl(linkValue);
    if (url === null) {
      toast({ title: 'That link is not allowed', description: 'Use a web address (https://…) or an email address.', variant: 'destructive' });
      return;
    }
    if (!url) chain().extendMarkRange('link').unsetLink().run();
    else if (editor.state.selection.empty && !editor.isActive('link')) {
      chain().insertContent({ type: 'text', text: linkValue.trim(), marks: [{ type: 'link', attrs: { href: url } }] }).run();
    } else chain().extendMarkRange('link').setLink({ href: url }).run();
    setLinkOpen(false);
  };

  const inTable = editor.isActive('table');

  return (
    <div className={cn('pms-editor flex flex-col rounded-md border bg-background', className)}>
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1">
        <ToolButton label="Undo" shortcut={`${MOD}+Z`} disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><Undo2 className="h-4 w-4" /></ToolButton>
        <ToolButton label="Redo" shortcut={`${MOD}+Y`} disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><Redo2 className="h-4 w-4" /></ToolButton>
        <Divider />

        {!compact && (
          <select aria-label="Paragraph style" className={cn(selectClass, 'w-[6.5rem]')} value={blockStyle} onChange={(e) => setBlockStyle(e.target.value)}>
            <option value="p">Normal</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
        )}
        <select aria-label="Font" className={cn(selectClass, 'w-[7.5rem]')} value={fontFamily}
          onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}>
          {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
        <select aria-label="Font size" className={cn(selectClass, 'w-[4.5rem]')} value={fontSize}
          onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}>
          <option value="">Size</option>
          {SIZES.map((s) => <option key={s} value={s}>{s.replace('pt', '')}</option>)}
        </select>
        <Divider />

        <ToolButton label="Bold" shortcut={`${MOD}+B`} active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold className="h-4 w-4" /></ToolButton>
        <ToolButton label="Italic" shortcut={`${MOD}+I`} active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolButton>
        <ToolButton label="Underline" shortcut={`${MOD}+U`} active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></ToolButton>
        <ToolButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolButton>
        {!compact && (<>
          <ToolButton label="Subscript" active={editor.isActive('subscript')} onClick={() => chain().toggleSubscript().run()}><SubIcon className="h-4 w-4" /></ToolButton>
          <ToolButton label="Superscript" active={editor.isActive('superscript')} onClick={() => chain().toggleSuperscript().run()}><SupIcon className="h-4 w-4" /></ToolButton>
        </>)}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Font colour" title="Font colour" onMouseDown={(e) => e.preventDefault()}
              className="inline-flex h-8 w-8 flex-col items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <Baseline className="h-4 w-4" />
              <span className="mt-[-2px] h-1 w-4 rounded-sm" style={{ backgroundColor: editor.getAttributes('textStyle').color || 'currentColor' }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3" align="start" onCloseAutoFocus={backToText}>
            <Swatches colours={TEXT_COLOURS} onPick={(c) => chain().setColor(c).run()}
              onClear={() => chain().unsetColor().run()} clearLabel="Automatic colour" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Highlight" title="Text highlight colour" onMouseDown={(e) => e.preventDefault()}
              className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
                editor.isActive('highlight') && 'bg-primary/10 text-primary')}>
              <Highlighter className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3" align="start" onCloseAutoFocus={backToText}>
            <Swatches colours={HIGHLIGHTS} onPick={(c) => chain().setHighlight({ color: c }).run()}
              onClear={() => chain().unsetHighlight().run()} clearLabel="No highlight" />
          </PopoverContent>
        </Popover>
        <ToolButton label="Clear formatting" shortcut={`${MOD}+Space`} onClick={() => chain().clearFormatting().run()}><RemoveFormatting className="h-4 w-4" /></ToolButton>
        <Divider />

        <ToolButton label="Bullets" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><List className="h-4 w-4" /></ToolButton>
        <ToolButton label="Numbering" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolButton>
        <ToolButton label="Decrease indent" shortcut="Shift+Tab" onClick={() => chain().outdent().run()}><IndentDecrease className="h-4 w-4" /></ToolButton>
        <ToolButton label="Increase indent" shortcut="Tab" onClick={() => chain().indent().run()}><IndentIncrease className="h-4 w-4" /></ToolButton>
        {!compact && (<>
          <ToolButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolButton>
          <ToolButton label="Centre" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolButton>
          <ToolButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolButton>
          <ToolButton label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></ToolButton>
          <ToolButton label="Quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolButton>
        </>)}
        <Divider />

        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Link" title={`Link (${MOD}+K)`} onMouseDown={(e) => e.preventDefault()} onClick={openLink}
              className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
                editor.isActive('link') && 'bg-primary/10 text-primary')}>
              <Link2 className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start" onCloseAutoFocus={backToText}>
            <form onSubmit={(e) => { e.preventDefault(); applyLink(); }} className="space-y-2">
              <label className="text-xs font-medium" htmlFor="pms-link">Web or email address</label>
              <Input id="pms-link" autoFocus value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://… or name@example.com" />
              <div className="flex justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setLinkValue(''); chain().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }}>Remove link</Button>
                <Button type="submit" size="sm">Apply</Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>

        {!compact && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Table" title="Table" onMouseDown={(e) => e.preventDefault()}
                className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
                  inTable && 'bg-primary/10 text-primary')}>
                <TableIcon className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={backToText}>
              <DropdownMenuItem onSelect={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Insert 3 × 3 table</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()}>Insert 2 × 2 table</DropdownMenuItem>
              {inTable && (<>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => chain().addRowBefore().run()}>Row above</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => chain().addRowAfter().run()}>Row below</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => chain().addColumnBefore().run()}>Column left</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => chain().addColumnAfter().run()}>Column right</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => chain().toggleHeaderRow().run()}>Header row on/off</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => chain().mergeOrSplit().run()}>Merge / split cells</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => chain().deleteRow().run()}>Delete row</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => chain().deleteColumn().run()}>Delete column</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onSelect={() => chain().deleteTable().run()}>Delete table</DropdownMenuItem>
              </>)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <ToolButton label={uploading ? 'Adding picture…' : 'Picture'} disabled={uploading > 0} onClick={() => fileInput.current?.click()}>
          <ImagePlus className={cn('h-4 w-4', uploading > 0 && 'animate-pulse')} />
        </ToolButton>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden
          onChange={(e) => { uploadImages(Array.from(e.target.files || []), editor); e.target.value = ''; }} />
        <EmojiPicker onPick={(emoji) => chain().insertContent(emoji).run()} onCloseAutoFocus={backToText} />

        {grammarEnabled && (<>
          <Divider />
          <ToolButton label="Check spelling and grammar" active={grammarOpen} onClick={() => setGrammarOpen((o) => !o)}>
            <SpellCheck className="h-4 w-4" />
          </ToolButton>
        </>)}
        {toolbarEnd && <><Divider />{toolbarEnd}</>}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight }} onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} style={{ minHeight }} />
      </div>

      {grammarOpen && <GrammarPanel editor={editor} onClose={() => setGrammarOpen(false)} />}
    </div>
  );
});
