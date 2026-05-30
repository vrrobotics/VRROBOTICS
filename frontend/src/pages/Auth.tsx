import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Users, Eye, EyeOff, Loader2 } from "lucide-react";

/**
 * VR Robotics Academy — basic authentication UI (Login + Sign Up).
 * Self-contained page wired to the existing auth hook/backend. Supports a
 * Student / Teacher role on sign up (Teacher registers as `instructor`, which
 * the auth-service /register endpoint already accepts).
 *
 * Query params:
 *   ?mode=signup|login   initial tab
 *   ?role=teacher        preselect the Teacher role + signup tab
 */
const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginUser, registerUser, loading } = useAuth();

  const initialTeacher = params.get("role") === "teacher";
  const [mode, setMode] = useState<"login" | "signup">(
    initialTeacher || params.get("mode") === "signup" ? "signup" : "login",
  );
  const [role, setRole] = useState<"student" | "instructor">(
    initialTeacher ? "instructor" : "student",
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Password-length rule applies to NEW accounts only — existing accounts
    // (e.g. admins) may have shorter legacy passwords and must still log in.
    if (mode === "signup") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (!/^\d{10,15}$/.test(phone.trim())) {
        setError("Enter a valid phone number (10-15 digits).");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        await registerUser({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          phone: phone.trim(),
          // Backend requires these; sensible defaults for the basic form.
          dob: "2000-01-01",
          gender: "male",
        });
        navigate(role === "instructor" ? "/instructor" : "/", { replace: true });
      } else {
        const profile = await loginUser({ email: email.trim(), password });
        // Route by role: admins → admin dashboard, instructors → their
        // dashboard, everyone else → home.
        const r = profile?.role;
        if (r === "admin" || r === "root" || r === "manager" || r === "editor") {
          navigate("/admin/dashboard", { replace: true });
        } else if (r === "instructor") {
          navigate("/instructor", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        (mode === "signup" ? "Sign up failed." : "Login failed.");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const working = busy || loading;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gradient-subtle">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-center gap-6 p-14 bg-gradient-hero text-white">
        <Link to="/" className="font-heading text-3xl font-extrabold">
          VR Robotics Academy
        </Link>
        <p className="text-2xl font-semibold leading-snug max-w-md">
          Learn Robotics & AI faster — with clear guidance and real projects.
        </p>
        <p className="text-white/80 max-w-md">
          Sign in to access your courses, or create an account as a student or a
          teacher to get started.
        </p>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8">
          <div className="lg:hidden mb-6 text-center font-heading text-2xl font-extrabold">
            <span className="text-gradient">VR</span> Robotics Academy
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 mb-6 rounded-lg bg-muted p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className={`py-2 rounded-md text-sm font-semibold transition-colors ${
                  mode === m ? "bg-white shadow text-primary" : "text-muted-foreground"
                }`}
              >
                {m === "login" ? "Login" : "Sign Up"}
              </button>
            ))}
          </div>

          <h1 className="text-2xl font-bold mb-1">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === "login"
              ? "Enter your credentials to continue."
              : "Join VR Robotics Academy in a minute."}
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <>
                {/* Role selector */}
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { val: "student", label: "Student", icon: Users },
                    { val: "instructor", label: "Teacher", icon: GraduationCap },
                  ] as const).map((r) => (
                    <button
                      type="button"
                      key={r.val}
                      onClick={() => setRole(r.val)}
                      className={`flex items-center gap-2 justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        role === r.val
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <r.icon className="w-4 h-4" /> {r.label}
                    </button>
                  ))}
                </div>

                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="10-digit mobile number"
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div>
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type={showPwd ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter your password"
                />
              </div>
            )}

            <Button type="submit" disabled={working} className="w-full bg-gradient-hero border-0">
              {working && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "login" ? "Login" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button onClick={() => { setMode("signup"); setError(null); }} className="text-primary font-semibold">
                  Sign Up
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("login"); setError(null); }} className="text-primary font-semibold">
                  Login
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
