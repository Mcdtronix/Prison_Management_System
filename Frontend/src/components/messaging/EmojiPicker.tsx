import { useState } from 'react';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** A local, curated emoji set: no downloads, no external services. */
const GROUPS: { label: string; emoji: string }[] = [
  { label: 'Smileys', emoji: '😀 😃 😄 😁 😊 🙂 😉 😍 😘 😎 🤗 🤔 😐 😑 😶 🙄 😏 😮 😯 😲 😴 😌 😛 😜 😢 😭 😤 😠 😡 😳 😱 😨 😰 😓 🤝 👏 🙏' },
  { label: 'Gestures', emoji: '👍 👎 👌 ✌️ 🤞 👋 🤚 ✋ 👊 ✊ 💪 👈 👉 👆 👇 ☝️ 🫡' },
  { label: 'Symbols', emoji: '✅ ☑️ ✔️ ❌ ❎ ⚠️ ❗ ❓ ‼️ ⛔ 🚫 🔴 🟠 🟡 🟢 🔵 ⭐ 🌟 💡 🔔 📌 📍 🔒 🔓 🔑 ❤️ 💯 ➡️ ⬅️ ⬆️ ⬇️ 🔁' },
  { label: 'Work', emoji: '📅 📆 🗓️ ⏰ ⏳ 📝 📄 📃 📋 📁 📂 🗂️ 📎 🖊️ ✏️ 📊 📈 📉 💼 🏢 🏛️ 🚓 🚑 🚒 🩺 💊 🏥 📞 ☎️ 📧 📨 💻 🖨️' },
  { label: 'Nature', emoji: '☀️ 🌤️ ⛅ 🌧️ ⛈️ 🌩️ 🌈 🔥 💧 🌱 🌳 🌾 🌽 🍅 🥕 🐄 🐐 🐓 🐖' },
  { label: 'Celebrate', emoji: '🎉 🎊 🎂 🎁 🏆 🥇 🎖️ 🇿🇼' },
];

export function EmojiPicker({ onPick, disabled, onCloseAutoFocus }: {
  onPick: (emoji: string) => void; disabled?: boolean; onCloseAutoFocus?: (e: Event) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label="Insert emoji" title="Emoji"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
          <Smile className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2" onCloseAutoFocus={onCloseAutoFocus}>
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emoji.split(' ').map((e) => (
                  <button key={e} type="button" onClick={() => { onPick(e); setOpen(false); }}
                    className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted" aria-label={`Insert ${e}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
