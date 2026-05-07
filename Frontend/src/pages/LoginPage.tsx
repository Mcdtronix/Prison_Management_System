
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="mb-4 rounded-md bg-[#0b4f2a] p-3 ring-2 ring-[#d7a928]">
            <Gavel className="h-8 w-8 text-[#d7a928]" />
          </div>
          <CardTitle className="text-2xl font-semibold text-center text-gray-900">PrisonMS</CardTitle>
          <CardDescription className="text-center text-gray-600">
            Zimbabwe Prisons and Correctional Services
          </CardDescription>
          <div className="w-full border-t border-gray-200 my-4"></div>
          <div className="text-sm text-center text-gray-600 bg-gray-50 p-4 rounded-lg w-full border border-gray-200">
            <p className="font-medium text-gray-900 mb-2">Login Instructions:</p>
            <p className="text-xs">Enter your service number and password</p>
            <p className="text-xs mt-1">Format: 1234567A (7 digits + letter)</p>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {loginError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="serviceNumber">Service Number</Label>
              <Input
                id="serviceNumber"
                placeholder="e.g., 2934823Z"
                value={serviceNumber}
                onChange={(e) => setServiceNumber(e.target.value.toUpperCase())}
                disabled={isLoading}
                className={loginError?.includes('service number') ? 'border-red-500' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Your unique 8-character service identifier
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className={loginError?.includes('password') ? 'border-red-500' : ''}
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
          <div className="text-xs text-center text-muted-foreground">
            <p>For technical support, contact your system administrator</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
