import React, { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCircle2,
  KeyRound,
  Laptop,
  Moon,
  Palette,
  Phone,
  Shield,
  Sun,
  Type,
  User,
} from 'lucide-react';

import { PrisonLayout } from '@/components/PrisonLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type TextSize } from '@/contexts/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getRoleDisplayName } from '@/lib/auth';
import { cn } from '@/lib/utils';

type ThemeChoice = 'light' | 'dark' | 'system';

/* ------------------------------------------------------------------ */
/* Layout primitives                                                   */
/* ------------------------------------------------------------------ */

const Section = ({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) => (
  <section className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
    <header className="border-b border-border px-5 py-4 sm:px-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </header>
    <div className="px-5 py-5 sm:px-6">{children}</div>
    {footer && (
      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-muted/40 px-5 py-3 sm:px-6">
        {footer}
      </footer>
    )}
  </section>
);

const Row = ({
  label,
  description,
  control,
  htmlFor,
}: {
  label: ReactNode;
  description?: ReactNode;
  control: ReactNode;
  htmlFor?: string;
}) => (
  <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
    <div className="min-w-0 space-y-0.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

const ReadOnlyField = ({ label, value, mono = false }: { label: string; value?: ReactNode; mono?: boolean }) => (
  <div className="space-y-1">
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className={cn('text-sm', mono && 'font-mono', !value && 'text-muted-foreground')}>{value || 'Not on record'}</dd>
  </div>
);

/* ------------------------------------------------------------------ */
/* Appearance                                                          */
/* ------------------------------------------------------------------ */

/** Miniature of the app shell (sidebar, header, content) in one theme. */
const ShellMiniature = ({ mode }: { mode: 'light' | 'dark' }) => {
  const dark = mode === 'dark';
  return (
    <div className={cn('flex h-full w-full', dark ? 'bg-slate-900' : 'bg-slate-100')}>
      <div className={cn('flex w-[26%] flex-col gap-1.5 p-2', dark ? 'bg-[#06301a]' : 'bg-[#0b4f2a]')}>
        <span className="h-2 w-2 rounded-sm bg-[#d7a928]" />
        <span className="h-1 w-4/5 rounded-full bg-white/50" />
        <span className="h-1 w-3/5 rounded-full bg-white/30" />
        <span className="h-1 w-4/5 rounded-full bg-white/30" />
      </div>
      <div className="flex flex-1 flex-col">
        <div className={cn('h-3', dark ? 'bg-[#06301a]' : 'bg-[#0b4f2a]')} />
        <div className="flex flex-1 flex-col gap-1.5 p-2">
          <div className={cn('rounded-sm p-1.5', dark ? 'bg-slate-800' : 'bg-white shadow-sm')}>
            <span className={cn('block h-1 w-1/2 rounded-full', dark ? 'bg-slate-500' : 'bg-slate-300')} />
            <span className={cn('mt-1 block h-1 w-3/4 rounded-full', dark ? 'bg-slate-600' : 'bg-slate-200')} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <span className={cn('h-4 rounded-sm', dark ? 'bg-slate-800' : 'bg-white shadow-sm')} />
            <span className={cn('h-4 rounded-sm', dark ? 'bg-slate-800' : 'bg-white shadow-sm')} />
          </div>
        </div>
      </div>
    </div>
  );
};

const THEMES: { value: ThemeChoice; label: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', description: 'Best for bright offices and printing.', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Easier on the eyes on night shifts.', icon: Moon },
  { value: 'system', label: 'System', description: 'Matches this device’s setting.', icon: Laptop },
];

const ThemeOption = ({
  option,
  selected,
  onSelect,
}: {
  option: (typeof THEMES)[number];
  selected: boolean;
  onSelect: () => void;
}) => {
  const Icon = option.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border-2 bg-card text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7a928] focus-visible:ring-offset-2',
        selected ? 'border-[#0b4f2a] shadow-md dark:border-[#d7a928]' : 'border-border hover:border-muted-foreground/40 hover:shadow-sm',
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border">
        {option.value === 'system' ? (
          <div className="relative h-full w-full">
            <ShellMiniature mode="light" />
            <div className="absolute inset-0" style={{ clipPath: 'polygon(55% 0, 100% 0, 100% 100%, 45% 100%)' }}>
              <ShellMiniature mode="dark" />
            </div>
          </div>
        ) : (
          <ShellMiniature mode={option.value} />
        )}
        {selected && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#0b4f2a] text-white shadow dark:bg-[#d7a928] dark:text-[#0b4f2a]">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="flex items-start gap-2 px-3 py-2.5">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', selected ? 'text-[#0b4f2a] dark:text-[#d7a928]' : 'text-muted-foreground')} aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">{option.label}</p>
          <p className="text-xs text-muted-foreground">{option.description}</p>
        </div>
      </div>
    </button>
  );
};

const TEXT_SIZES: { value: TextSize; label: string; sample: string; description: string }[] = [
  { value: 'standard', label: 'Standard', sample: 'text-base', description: 'Default size for most screens.' },
  { value: 'large', label: 'Large', sample: 'text-xl', description: 'Easier reading on small or distant screens.' },
];

const AppearanceSettings = () => {
  const { theme, setTheme, resolvedTheme, textSize, setTextSize } = useTheme();

  const current =
    theme === 'system'
      ? `Following this device: currently ${resolvedTheme}.`
      : `${theme === 'dark' ? 'Dark' : 'Light'} theme on this device.`;

  return (
    <div className="space-y-6">
      <Section
        title="Theme"
        description="Choose how PrisonMS looks. Your choice is saved on this device only."
      >
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {THEMES.map((option) => (
            <ThemeOption
              key={option.value}
              option={option}
              selected={theme === option.value}
              onSelect={() => setTheme(option.value)}
            />
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Palette className="h-3.5 w-3.5" aria-hidden="true" />
          {current}
        </p>
      </Section>

      <Section title="Text size" description="Scales text and spacing across every screen.">
        <div role="radiogroup" aria-label="Text size" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TEXT_SIZES.map((size) => {
            const selected = textSize === size.value;
            return (
              <button
                key={size.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTextSize(size.value)}
                className={cn(
                  'flex items-center gap-4 rounded-lg border-2 px-4 py-3 text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7a928] focus-visible:ring-offset-2',
                  selected ? 'border-[#0b4f2a] bg-[#0b4f2a]/5 dark:border-[#d7a928] dark:bg-[#d7a928]/10' : 'border-border hover:border-muted-foreground/40',
                )}
              >
                <span
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted font-semibold',
                    size.sample,
                  )}
                  aria-hidden="true"
                >
                  Aa
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{size.label}</span>
                  <span className="block text-xs text-muted-foreground">{size.description}</span>
                </span>
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-[#0b4f2a] bg-[#0b4f2a] text-white dark:border-[#d7a928] dark:bg-[#d7a928] dark:text-[#0b4f2a]' : 'border-muted-foreground/40',
                  )}
                  aria-hidden="true"
                >
                  {selected && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          <p className="mt-1 font-semibold">0009/26 · Lovemore Zhou</p>
          <p className="text-sm text-muted-foreground">House Breaking · 1 yr · ODR 06 Nov 2027</p>
        </div>
      </Section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const NAV = [
  { value: 'appearance', label: 'Appearance', hint: 'Theme and text size', icon: Palette },
  { value: 'security', label: 'Security', hint: 'Password and sign-in', icon: Shield },
  { value: 'notifications', label: 'Notifications', hint: 'Alerts and sounds', icon: Bell },
  { value: 'account', label: 'Account', hint: 'Your officer profile', icon: User },
] as const;

const SettingsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(() => localStorage.getItem('2fa_enabled') === 'true');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave2FA = () => {
    setIsSaving(true);
    setTimeout(() => {
      localStorage.setItem('2fa_enabled', String(twoFactorEnabled));
      toast({
        title: 'Security settings updated',
        description: `Two-factor authentication is now ${twoFactorEnabled ? 'on' : 'off'}.`,
      });
      setIsSaving(false);
    }, 600);
  };

  const roleName = user?.roleName || (user?.role ? getRoleDisplayName(user.role) : '');
  const station = user?.station?.name || user?.station?.code;

  return (
    <PrisonLayout title="Settings" description="Manage your preferences and security">
      <div className="mx-auto max-w-5xl py-2 sm:py-4">
        <Tabs defaultValue="appearance" orientation="vertical" className="flex flex-col gap-6 md:flex-row">
          <TabsList className="flex h-auto w-full shrink-0 flex-row gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1.5 shadow-sm md:w-60 md:flex-col md:items-stretch md:self-start">
            {NAV.map(({ value, label, hint, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  'relative justify-start gap-3 rounded-md px-3 py-2.5 text-left text-foreground/80',
                  'data-[state=active]:bg-[#0b4f2a]/[0.07] data-[state=active]:text-foreground data-[state=active]:shadow-none',
                  'dark:data-[state=active]:bg-white/[0.06]',
                  'md:before:absolute md:before:inset-y-2 md:before:left-0 md:before:w-0.5 md:before:rounded-full md:data-[state=active]:before:bg-[#0b4f2a] dark:md:data-[state=active]:before:bg-[#d7a928]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="hidden text-xs font-normal text-muted-foreground md:block">{hint}</span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-w-0 flex-1">
            <TabsContent value="appearance" className="m-0">
              <AppearanceSettings />
            </TabsContent>

            <TabsContent value="security" className="m-0 space-y-6">
              <Section title="Password" description="The password you use with your service number to sign in.">
                <Row
                  label="Change password"
                  description="You will be asked for your current password. Use at least 10 characters."
                  control={
                    <Button variant="outline" onClick={() => navigate('/change-password')}>
                      <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                      Change password
                    </Button>
                  }
                />
              </Section>

              <Section
                title="Two-factor authentication"
                description="Add a verification code to your password when signing in."
                footer={
                  <Button onClick={handleSave2FA} disabled={isSaving} className="bg-[#0b4f2a] hover:bg-[#063f20]">
                    {isSaving ? 'Saving…' : 'Save security settings'}
                  </Button>
                }
              >
                <div className="divide-y divide-border">
                  <Row
                    htmlFor="two-factor"
                    label={
                      <span className="flex items-center gap-2">
                        SMS verification
                        {twoFactorEnabled && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="On" />}
                      </span>
                    }
                    description="Require a code sent by SMS in addition to your password."
                    control={<Switch id="two-factor" checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />}
                  />
                  {twoFactorEnabled && (
                    <div className="space-y-2 pt-4">
                      <Label htmlFor="phone">Phone number for codes</Label>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                          <Input
                            id="phone"
                            className="pl-9"
                            inputMode="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+263 77 123 4567"
                          />
                        </div>
                        <Button variant="outline">Update number</Button>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="notifications" className="m-0">
              <Section
                title="Notifications"
                description="Choose how you are told about messages and alerts."
                footer={<Button variant="outline">Save preferences</Button>}
              >
                <div className="divide-y divide-border">
                  <Row
                    htmlFor="notify-email"
                    label="Email notifications"
                    description="Daily summaries and critical alerts by email."
                    control={<Switch id="notify-email" defaultChecked />}
                  />
                  <Row
                    htmlFor="notify-sms"
                    label="SMS alerts"
                    description="Emergency system alerts by SMS."
                    control={<Switch id="notify-sms" defaultChecked={false} />}
                  />
                  <Row
                    htmlFor="notify-sound"
                    label="In-app sound"
                    description="Play a sound when a new message arrives."
                    control={<Switch id="notify-sound" defaultChecked />}
                  />
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="account" className="m-0">
              <Section
                title="Officer profile"
                description="Details of the account you are signed in with."
              >
                <div className="mb-5 flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d7a928] text-lg font-bold text-[#0b4f2a]">
                    {(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold">{user?.fullName || user?.username}</p>
                    <p className="text-sm text-muted-foreground">{roleName}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <ReadOnlyField label="Service number" value={user?.username} mono />
                  <ReadOnlyField label="Role" value={roleName} />
                  <ReadOnlyField label="Station" value={station} />
                  <ReadOnlyField label="Email" value={user?.email} />
                  <ReadOnlyField label="Department mailbox" value={user?.mailboxAddress} mono />
                </dl>
                <p className="mt-6 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  Your name, email and posting are maintained by your station system administrator. Contact them if any
                  of these details are wrong.
                </p>
              </Section>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </PrisonLayout>
  );
};

export default SettingsPage;
