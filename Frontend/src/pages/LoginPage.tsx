
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultRouteForRole } from '../lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Gavel, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import loginBackground from '@/assets/bckgrnd.jpg';

const LoginPage = () => {
  const [serviceNumber, setServiceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    // Client-side validation
    if (!serviceNumber.trim()) {
      setLoginError('Service number is required');
      return;
    }

    if (!password) {
      setLoginError('Password is required');
      return;
    }

    // Validate service number format
    const serviceNumberRegex = /^[0-9]{7}[A-Z]$/;
    if (!serviceNumberRegex.test(serviceNumber)) {
      setLoginError('Invalid service number format. Must be 7 digits followed by a letter (e.g., 2934823Z)');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(serviceNumber, password);

      if (result.success) {
        toast({
          title: "Login Successful",
          description: "Welcome to the Prison Management System",
        });

        const userRole = localStorage.getItem('user_role');
        navigate(getDefaultRouteForRole(userRole), { replace: true });
      } else {
        setLoginError(result.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Unable to connect to the server. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-gray-50 px-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${loginBackground})` }}
    >
      <div className="absolute inset-0 bg-black/55" />
      <Card className="relative z-10 w-full max-w-md border border-white/30 bg-white/15 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="mb-4 rounded-md bg-[#0b4f2a]/80 p-3 ring-2 ring-[#d7a928]">
            <Gavel className="h-8 w-8 text-[#d7a928]" />
          </div>
          <CardTitle className="text-2xl font-semibold text-center text-white">PrisonMS</CardTitle>
          <CardDescription className="text-center text-white/85">
            PCorrectional Services
          </CardDescription>
          <div className="w-full border-t border-white/25 my-4"></div>
          <div className="w-full rounded-lg border border-white/25 bg-white/10 p-4 text-center text-sm text-white/85">
            <p className="mb-2 font-medium text-white">Login Instructions:</p>
            <p className="text-xs">Enter your service number and password</p>
            <p className="text-xs mt-1">Format: 1234567A (7 digits + letter)</p>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {loginError && (
              <Alert className="border-red-300/70 bg-red-500/20 text-red-50">
                <AlertCircle className="h-4 w-4 text-red-100" />
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label className="text-white/95" htmlFor="serviceNumber">Service Number</Label>
              <Input
                id="serviceNumber"
                placeholder="e.g., 2934823Z"
                value={serviceNumber}
                onChange={(e) => setServiceNumber(e.target.value.toUpperCase())}
                disabled={isLoading}
                className={`h-11 border-white/35 bg-white/15 text-white placeholder:text-white/60 focus-visible:ring-[#d7a928] ${loginError?.includes('service number') ? 'border-red-400' : ''}`}
              />
              <p className="text-xs text-white/70">
                Your unique 8-character service identifier
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-white/95" htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className={`h-11 border-white/35 bg-white/15 text-white placeholder:text-white/60 focus-visible:ring-[#d7a928] ${loginError?.includes('password') ? 'border-red-400' : ''}`}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full bg-[#0b4f2a] font-medium text-white hover:bg-[#063f20] disabled:opacity-50"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Authenticating...
                </>
              ) : (
                "Login to Portal"
              )}
            </Button>
          </CardFooter>
        </form>

        <div className="px-6 pb-4">
          <div className="text-xs text-center text-white/70">
            <p>For technical support, contact your system administrator</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
