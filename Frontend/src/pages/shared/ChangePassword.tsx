import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2, LogOut } from 'lucide-react';
import { authApi } from '@/lib/api';
import { getLandingRouteForUser } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { primaryButton } from '@/components/console/ConsoleUI';

const rules = [
  { test: (p: string) => p.length >= 10, label: 'At least 10 characters' },
  { test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p), label: 'Upper- and lower-case letters' },
  { test: (p: string) => /\d/.test(p), label: 'At least one number' },
];

const ChangePassword = () => {
  const { user, loading, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && !user) return <Navigate to="/login" replace />;

  const forced = !!user?.mustChangePassword;
  const valid = current && rules.every((r) => r.test(next)) && next === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authApi.changePassword(current, next);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    await refreshUser();
    setBusy(false);
    navigate(getLandingRouteForUser(user?.role, user?.orgUnitType || null, user?.station?.id || null), { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#0b4f2a] to-[#d7a928]" />
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#0b4f2a]">
            <KeyRound className="h-6 w-6 text-[#d7a928]" />
          </div>
          <CardTitle>{forced ? 'Set a new password' : 'Change password'}</CardTitle>
          <CardDescription>
            {forced
              ? 'Your password was reset by an administrator. Choose a new one to continue. Only you will know it.'
              : 'You will stay signed in on this device; other devices will be signed out.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">{forced ? 'One-time password' : 'Current password'}</Label>
              <Input id="cur" type={show ? 'text' : 'password'} autoComplete="current-password" value={current}
                onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <div className="relative">
                <Input id="new" type={show ? 'text' : 'password'} autoComplete="new-password" value={next}
                  onChange={(e) => setNext(e.target.value)} className="pr-10" />
                <button type="button" aria-label={show ? 'Hide passwords' : 'Show passwords'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShow(!show)}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <ul className="space-y-1 pt-1">
                {rules.map((r) => (
                  <li key={r.label} className={`text-xs ${r.test(next) ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                    {r.test(next) ? '✓' : '•'} {r.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conf">Confirm new password</Label>
              <Input id="conf" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} />
              {confirm && confirm !== next && <p className="text-xs text-red-600">Passwords do not match.</p>}
            </div>
            {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button type="submit" className={`w-full ${primaryButton}`} disabled={!valid || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save new password
            </Button>
            {forced ? (
              <Button type="button" variant="ghost" className="w-full" onClick={() => logout().then(() => navigate('/login'))}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out instead
              </Button>
            ) : (
              <Button type="button" variant="ghost" className="w-full" onClick={() => navigate(-1)}>Cancel</Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;
