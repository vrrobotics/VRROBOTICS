import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  BookOpen, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock,
  ArrowLeft,
  Users,
  Award,
  Globe
} from "lucide-react";
import Logo from "@/assets/YagnaTechWM.png"; // Adjust the path as necessary

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Authentication logic will be implemented in phase 2
    console.log("Login attempt:", { email, password, rememberMe });
  };

  const benefits = [
    {
      icon: BookOpen,
      title: "Access All Courses",
      description: "Unlock our complete library of professional development courses"
    },
    {
      icon: Award,
      title: "Earn Certificates",
      description: "Get recognized certificates upon course completion"
    },
    {
      icon: Users,
      title: "Join Community",
      description: "Connect with fellow learners and mentors worldwide"
    },
    {
      icon: Globe,
      title: "Learn Anywhere",
      description: "Study at your own pace from any device, anywhere"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container-ngo py-8">
        {/* Back to Home */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/" className="flex items-center space-x-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Left Side - Benefits */}
          <div className="w-3/4 mx-auto">
  <img
    src= {Logo} // replace with your actual image path
    alt="Learning Journey"
    className="w-80 h-auto rounded-lg  object-contain "
  />
</div>


          {/* Right Side - Login Form */}
          <div className="w-full max-w-md mx-auto">
            <Card className="card-ngo border-0">
              <CardHeader className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
                <CardDescription>
                  Enter your credentials 
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                      />
                      <Label htmlFor="remember" className="text-sm">
                        Remember me
                      </Label>
                    </div>
                    <Button variant="link" className="text-sm p-0 h-auto">
                      Forgot password?
                    </Button>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-hero border-0" 
                    size="lg"
                  >
                    Sign In
                  </Button>
                </form>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Button variant="link" className="p-0 h-auto" asChild>
                      <Link to="/signup">Sign Up</Link>
                    </Button>
                  </p>
                </div>

                {/* <div className="text-center pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    By signing in, you agree to our{" "}
                    <Button variant="link" className="p-0 h-auto text-xs">
                      Terms of Service
                    </Button>{" "}
                    and{" "}
                    <Button variant="link" className="p-0 h-auto text-xs">
                      Privacy Policy
                    </Button>
                  </p>
                </div> */}
              </CardContent>
            </Card>

            <div className="text-center mt-6">
              <p className="text-sm text-muted-foreground">
                Need help?{" "}
                <Button variant="link" className="p-0 h-auto text-sm" asChild>
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;