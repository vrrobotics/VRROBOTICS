import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  Sparkles,
  Code2,
  Gamepad2,
  Box,
  CircuitBoard,
  Bot,
  Cpu,
  Brain,
  Eye,
  Wifi,
  Trophy,
  Rocket,
  Lightbulb,
  Wrench,
  Terminal,
  Bug,
  Presentation,
  PartyPopper,
  ClipboardList,
  CalendarCheck,
  MessageSquare,
  ListChecks,
  KeyRound,
  Award,
  Users,
  GraduationCap,
  ShieldCheck,
  Quote,
} from "lucide-react";

/**
 * VR Robotics Academy landing page — recreated in React/Tailwind from the
 * VR Robotics static export (index.vrrobotics-backup.html). Replaces the
 * previous Roboprenr content. Self-contained: copy, team, curriculum, process,
 * certificates, projects and partners all come from that backup.
 */

const ROBOT_IMG =
  "https://image2url.com/r2/default/images/1775200145399-f0e4d8bd-15f4-46de-b4ea-3a5744599aa1.png";

const learnTracks = [
  { title: "Coding Foundations", icon: Code2, tint: "from-blue-500 to-indigo-600", desc: "Build your first programs and understand core computational thinking." },
  { title: "Creative Game Design", icon: Gamepad2, tint: "from-fuchsia-500 to-purple-600", desc: "Design interactive animations and games using visual programming." },
  { title: "3D Innovation Studio", icon: Box, tint: "from-amber-500 to-orange-600", desc: "Transform ideas into 3D models and prototypes for real-world solutions." },
  { title: "Electronics & Circuit Design", icon: CircuitBoard, tint: "from-emerald-500 to-teal-600", desc: "Master circuits, sensors, and microcontroller programming." },
  { title: "Robotics Engineering", icon: Bot, tint: "from-rose-500 to-red-600", desc: "Assemble and program intelligent robots from scratch." },
  { title: "Advanced Robotics Engineering", icon: Cpu, tint: "from-cyan-600 to-blue-700", desc: "Design autonomous systems with complex sensors and actuators." },
  { title: "Python Programming", icon: Terminal, tint: "from-sky-500 to-indigo-600", desc: "Master professional coding with the industry-standard Python language." },
  { title: "AI & Machine Learning Basics", icon: Brain, tint: "from-violet-500 to-fuchsia-600", desc: "Train intelligent systems and understand artificial intelligence concepts." },
  { title: "Computer Vision Projects", icon: Eye, tint: "from-slate-600 to-slate-800", desc: "Enable robots to see and interpret the world through cameras." },
  { title: "IoT & Smart Technology", icon: Wifi, tint: "from-teal-500 to-emerald-600", desc: "Connect devices to the internet and build smart home systems." },
  { title: "Innovation Challenge", icon: Trophy, tint: "from-yellow-500 to-amber-600", desc: "Compete in robotics challenges and showcase your skills." },
  { title: "Final Grand Project", icon: Rocket, tint: "from-orange-500 to-rose-600", desc: "Apply all your knowledge in a comprehensive capstone project." },
];

const modules = [
  "Meet Your Robot", "Circuit Basics", "Your First Code", "Variables",
  "Functions", "Sensors", "Digital I/O", "Loops", "PWM & Motors",
  "Line Following", "Obstacle Avoidance", "Final Robot",
];

const buildSteps = [
  { title: "Ideation & Planning", icon: Lightbulb, desc: "Students brainstorm ideas, sketch designs, and plan their project. Mentors guide them through the design thinking process." },
  { title: "Building & Assembly", icon: Wrench, desc: "Time to bring ideas to life! Students assemble robots, connect components, and build physical prototypes with hands-on guidance." },
  { title: "Programming", icon: Code2, desc: "Students write code to control their creations. They learn to program sensors, motors, and create interactive behaviors." },
  { title: "Testing & Debugging", icon: Bug, desc: "Projects are tested, refined, and improved. Students learn that failure is part of the learning process and iterate to perfection." },
  { title: "Presentation", icon: Presentation, desc: "Students showcase their projects to peers and mentors, explaining their design choices and demonstrating functionality." },
  { title: "Celebration & Reflection", icon: PartyPopper, desc: "Celebrate achievements and reflect on learnings. Students receive feedback and plan their next innovative project!" },
];

const admissionSteps = [
  { title: "Online Application", icon: ClipboardList, desc: "Fill out our quick online form with basic information about your child — their interests, age, and goals. It takes just 5 minutes!" },
  { title: "Demo Session", icon: CalendarCheck, desc: "Schedule a 30-minute demo where your child can experience our VR robotics platform, meet our teachers, and ask questions." },
  { title: "Assessment & Feedback", icon: MessageSquare, desc: "After the demo, we provide personalized feedback and recommend the best learning path for your child based on their skill level." },
  { title: "Choose Your Program", icon: ListChecks, desc: "Select from our flexible plans — beginner, intermediate, or advanced. Start immediately in the next batch or your preferred schedule." },
  { title: "Get Started", icon: KeyRound, desc: "Get access to our platform, teachers, learning materials, and community. Your child begins their journey to becoming a tech innovator!" },
];

const certificates = [
  { tier: "Foundation", desc: "Foundation-level completion certificate for core robotics concepts, sensors, and basic automation." },
  { tier: "Basic", desc: "Basic program completion certificate focused on robotics fundamentals, creativity, and practical learning." },
  { tier: "Standard", desc: "Standard program completion certificate covering structured robotics learning and real project execution." },
  { tier: "Advanced", desc: "Advanced program completion certificate for higher-level robotics thinking, execution, and innovation." },
];

const whyChoose = [
  { title: "Expert Engineering Trainers", icon: GraduationCap, desc: "Every session is led by degree-qualified, background-verified engineers certified in our curriculum delivery methodology." },
  { title: "Project-Based Learning", icon: Wrench, desc: "100% hands-on — students build real robots and ship real projects rather than just watching lectures." },
  { title: "Recognized Certificates", icon: Award, desc: "Earn Foundation to Advanced completion certificates that document your child's growing expertise." },
  { title: "Future-Ready Curriculum", icon: Brain, desc: "An 18-module path spanning robotics, coding, AI, computer vision, and IoT — built for tomorrow's innovators." },
  { title: "Small, Personal Batches", icon: Users, desc: "Focused attention in small batches so every student gets mentor guidance at their own pace." },
  { title: "Trusted by Schools", icon: ShieldCheck, desc: "Partnered with reputed institutions to deliver world-class robotics, coding, and AI education on campus." },
];

const projects = [
  { title: "Line-Following Robot", desc: "A robot that uses sensors to follow a path autonomously.", icon: Bot, tint: "from-rose-500 to-red-600" },
  { title: "Obstacle-Avoiding Car", desc: "Self-driving car that navigates around obstacles.", icon: Cpu, tint: "from-blue-500 to-indigo-600" },
  { title: "VR Puzzle Game", desc: "Immersive virtual reality puzzle game.", icon: Gamepad2, tint: "from-fuchsia-500 to-purple-600" },
  { title: "Smart IoT Home", desc: "IoT project controlling lights and sensors.", icon: Wifi, tint: "from-teal-500 to-emerald-600" },
  { title: "Robotic Arm", desc: "Programmable arm for picking and placing objects.", icon: Wrench, tint: "from-amber-500 to-orange-600" },
  { title: "AI Chatbot", desc: "Conversational AI with natural language processing.", icon: Brain, tint: "from-violet-500 to-fuchsia-600" },
];

const Home = () => {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="overflow-hidden">
      {/* ───────────── Hero ───────────── */}
      <section id="home" className="relative bg-gradient-subtle">
        <div className="container-ngo grid lg:grid-cols-2 gap-10 items-center py-16 lg:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-semibold">
              <Sparkles className="w-4 h-4" /> The Future of STEM Education
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Learn <span className="text-gradient">Robotics & AI</span> Faster —
              With Clear Guidance and Real Projects.
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Structured courses, expert support, and hands-on learning for
              students and beginners. Live in Future with VR Robotics Academy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-gradient-hero border-0 text-lg px-8" onClick={() => setDemoOpen(true)}>
                Book Demo <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8" asChild>
                <a href="#curriculum">Explore Curriculum</a>
              </Button>
            </div>
          </div>

          <div className="relative flex justify-center items-center min-h-[420px]">
            {/* Soft pulsing aura */}
            <div className="absolute w-[360px] h-[360px] rounded-full bg-gradient-to-br from-primary/40 via-orange-300/30 to-transparent blur-3xl animate-glow-pulse" />

            {/* Slowly spinning dashed orbit ring */}
            <div className="absolute w-[420px] h-[420px] rounded-full border-2 border-dashed border-primary/30 animate-ring-spin" />

            {/* Drifting glow orbs */}
            <span className="absolute top-6 left-10 w-4 h-4 rounded-full bg-primary/70 blur-[2px] animate-orb-drift" />
            <span className="absolute bottom-16 right-8 w-6 h-6 rounded-full bg-orange-400/60 blur-[2px] animate-orb-drift" style={{ animationDelay: "1.5s" }} />
            <span className="absolute top-1/2 right-16 w-3 h-3 rounded-full bg-amber-300/80 blur-[1px] animate-orb-drift" style={{ animationDelay: "3s" }} />
            <span className="absolute bottom-8 left-20 w-2.5 h-2.5 rounded-full bg-primary/80 animate-orb-drift" style={{ animationDelay: "0.8s" }} />

            {/* Floating robot */}
            <img
              src={ROBOT_IMG}
              alt="VR Robotics learning robot"
              className="relative z-10 w-full max-w-md object-contain drop-shadow-2xl animate-robot-float"
              loading="lazy"
            />

            {/* Breathing ground shadow */}
            <div className="absolute bottom-4 left-1/2 w-52 h-5 bg-black/40 rounded-[50%] blur-xl animate-shadow-breathe" />
          </div>
        </div>

      </section>

      {/* ───────────── What Kids Learn ───────────── */}
      <section id="learn" className="section-padding">
        <div className="container-ngo">
          <div className="text-center space-y-3 mb-14">
            <p className="text-primary font-semibold">What Kids Learn</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              A complete journey across <span className="text-gradient">robotics, coding & AI</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {learnTracks.map((t) => (
              <Card key={t.title} className="card-ngo border-0 overflow-hidden flex flex-col">
                <div className={`h-2 bg-gradient-to-r ${t.tint}`} />
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.tint} flex items-center justify-center mb-4`}>
                    <t.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{t.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{t.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── 18-Module Learning Path ───────────── */}
      <section id="curriculum" className="section-padding bg-gradient-subtle">
        <div className="container-ngo">
          <div className="text-center space-y-3 mb-14">
            <p className="text-primary font-semibold">Curriculum</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              18-Module <span className="text-gradient">Learning Path</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A structured, step-by-step progression from your first circuit to a
              fully autonomous robot.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m, i) => (
              <div key={m} className="flex items-center gap-4 rounded-xl bg-white border border-orange-100 p-4 shadow-soft">
                <span className="w-10 h-10 shrink-0 rounded-lg bg-gradient-hero text-white font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="font-medium">{m}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── How We Build ───────────── */}
      <section id="build" className="section-padding">
        <div className="container-ngo">
          <div className="text-center space-y-3 mb-14">
            <p className="text-primary font-semibold">How We Build</p>
            <h2 className="text-3xl md:text-4xl font-bold">Our project-based learning process</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {buildSteps.map((s, i) => (
              <Card key={s.title} className="card-ngo border-0">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-gradient-hero flex items-center justify-center">
                      <s.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-primary">STEP {i + 1}</span>
                  </div>
                  <h3 className="font-semibold text-lg">{s.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Why Choose ───────────── */}
      <section id="why" className="section-padding bg-gradient-subtle">
        <div className="container-ngo">
          <div className="text-center space-y-3 mb-14">
            <p className="text-primary font-semibold">Why VR Robotics</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              Why Choose <span className="text-gradient">VR Robotics Academy?</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChoose.map((w) => (
              <Card key={w.title} className="card-ngo border-0">
                <CardHeader className="space-y-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-hero flex items-center justify-center">
                    <w.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{w.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="leading-relaxed">{w.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Admission Process ───────────── */}
      <section id="admission" className="section-padding">
        <div className="container-ngo">
          <div className="text-center space-y-3 mb-14">
            <p className="text-primary font-semibold">Admission Process</p>
            <h2 className="text-3xl md:text-4xl font-bold">Getting started is easy</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {admissionSteps.map((s, i) => (
              <div key={s.title} className="text-center space-y-3">
                <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-hero flex items-center justify-center">
                  <s.icon className="w-7 h-7 text-white" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-orange-200 text-primary text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Certificates ───────────── */}
      <section id="certs" className="section-padding bg-gradient-subtle">
        <div className="container-ngo">
          <div className="text-center space-y-3 mb-14">
            <p className="text-primary font-semibold">Certificates</p>
            <h2 className="text-3xl md:text-4xl font-bold">Recognized completion certificates</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {certificates.map((c) => (
              <Card key={c.tier} className="card-ngo border-0 text-center">
                <CardContent className="p-6 space-y-3">
                  <Award className="w-10 h-10 text-primary mx-auto" />
                  <CardTitle className="text-lg">{c.tier}</CardTitle>
                  <CardDescription className="leading-relaxed">{c.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Student Projects ───────────── */}
      <section id="projects" className="section-padding">
        <div className="container-ngo">
          <div className="text-center space-y-3 mb-14">
            <p className="text-primary font-semibold">Student Projects</p>
            <h2 className="text-3xl md:text-4xl font-bold">What our students build</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <Card key={p.title} className="card-ngo border-0 overflow-hidden">
                <div className={`h-40 bg-gradient-to-br ${p.tint} flex items-center justify-center`}>
                  <p.icon className="w-14 h-14 text-white/90" />
                </div>
                <CardContent className="p-5 space-y-2">
                  <h3 className="font-semibold text-lg">{p.title}</h3>
                  <p className="text-muted-foreground text-sm">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── CTA / Book Demo ───────────── */}
      <section id="contact" className="section-padding pt-0">
        <div className="container-ngo">
          <div className="rounded-3xl bg-gradient-hero text-white p-10 md:p-16 text-center space-y-6">
            <Quote className="w-10 h-10 mx-auto opacity-80" />
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to build young innovators?
            </h2>
            <p className="text-white/90 max-w-2xl mx-auto">
              Book a 30-minute demo session — your child can experience our VR
              robotics platform, meet our teachers, and ask questions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="text-lg px-8" onClick={() => setDemoOpen(true)}>
                Book Demo
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 border-white text-white hover:bg-white hover:text-primary" asChild>
                <Link to="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Book Demo modal ───────────── */}
      {demoOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDemoOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-7 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-hero flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold">Book a Demo Session</h3>
              <p className="text-sm text-muted-foreground">Enter your details and we'll reach out to schedule.</p>
            </div>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setDemoOpen(false); }}>
              <input required placeholder="Child's name" className="w-full rounded-lg border px-4 py-2.5 outline-none focus:border-primary" />
              <input required type="tel" placeholder="Parent's phone" className="w-full rounded-lg border px-4 py-2.5 outline-none focus:border-primary" />
              <input type="email" placeholder="Email (optional)" className="w-full rounded-lg border px-4 py-2.5 outline-none focus:border-primary" />
              <Button type="submit" className="w-full bg-gradient-hero border-0">Request Demo</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
