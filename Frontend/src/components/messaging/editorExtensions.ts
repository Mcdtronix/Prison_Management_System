/**
 * Small TipTap extensions the editor needs that TipTap 2 does not ship:
 * font size, paragraph indent, and Outlook's Ctrl+Space "clear formatting".
 * Everything they produce is allowed by the server's cleaner
 * (Messaging/richtext.py): font-size and margin-left styles only.
 */
import { Extension } from '@tiptap/react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
    clearFormatting: {
      clearFormatting: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: { fontSize?: string | null }) =>
            attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size) => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const INDENT_STEP_EM = 2;
const MAX_INDENT = 8;

/** Indent paragraphs and headings; inside lists, Tab nests the item instead. */
export const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el: HTMLElement) => {
            const em = parseFloat(el.style.marginLeft || '0');
            return Number.isFinite(em) ? Math.min(MAX_INDENT, Math.round(em / INDENT_STEP_EM)) : 0;
          },
          renderHTML: (attrs: { indent?: number }) =>
            attrs.indent ? { style: `margin-left: ${attrs.indent * INDENT_STEP_EM}em` } : {},
        },
      },
    }];
  },
  addCommands() {
    const shift = (delta: number) => () => ({ editor, chain }: any) => {
      if (editor.isActive('listItem')) {
        return delta > 0
          ? chain().sinkListItem('listItem').run()
          : chain().liftListItem('listItem').run();
      }
      const type = editor.isActive('heading') ? 'heading' : 'paragraph';
      const current = editor.getAttributes(type).indent || 0;
      const next = Math.max(0, Math.min(MAX_INDENT, current + delta));
      return chain().updateAttributes(type, { indent: next }).run();
    };
    return { indent: shift(1), outdent: shift(-1) };
  },
  addKeyboardShortcuts() {
    // Inside a table, Tab moves between cells (handled by the table extension).
    const inTable = () => this.editor.isActive('table');
    return {
      Tab: () => (inTable() ? false : this.editor.commands.indent()),
      'Shift-Tab': () => (inTable() ? false : this.editor.commands.outdent()),
    };
  },
});

export const ClearFormatting = Extension.create({
  name: 'clearFormatting',
  addCommands() {
    return {
      clearFormatting: () => ({ chain }) => chain().unsetAllMarks().clearNodes().run(),
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-Space': () => this.editor.commands.clearFormatting() };
  },
});

/** Word and Outlook paste extra markup; drop it before the editor parses. */
export const tidyPastedHtml = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?o:p>/g, '')
    .replace(/<xml>[\s\S]*?<\/xml>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
