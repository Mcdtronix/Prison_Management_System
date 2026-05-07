import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import landingBackground from "@/assets/bckgrnd.jpg";

interface AuthResponse {
  token: string;
  role: string;
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await authApi.login(email, password);

      if (response.error) {
        toast({
          title: "Login failed",
          description: response.error,
          variant: "destructive",
        });

        return;
      }

      if (response.data) {
        const authData = response.data as AuthResponse;

        // Store token
        localStorage.setItem("token", authData.token);

        toast({
          title: "Login successful",
          description: "Redirecting to your dashboard...",
        });

        // Redirect by role
        switch (authData.role) {
          case "student":
            navigate("/student");
            break;

          case "teacher":
            navigate("/teacher");
            break;

          case "admin":
            navigate("/admin");
            break;

          default:
            navigate("/");
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />

      <main
        className="relative flex-1 flex items-center justify-center min-h-screen overflow-hidden"
        style={{
          backgroundImage: `url(${landingBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Login Card */}
        <Card className="relative z-10 w-full max-w-md mx-4 bg-white/90 backdrop-blur-md shadow-2xl border border-white/20">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl font-bold text-center text-gray-800">
              Login
            </CardTitle>

            <CardDescription className="text-center text-gray-600">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>

                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>

                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button
                type="submit"
                className="w-full h-11 text-base"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>

              <p className="text-center text-sm text-gray-600">
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="text-primary font-medium hover:underline"
                >
                  Register
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>

      <AppFooter />
    </div>
  );
};

export default Login;