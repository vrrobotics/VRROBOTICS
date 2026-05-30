import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, BookOpen, ImageIcon } from "lucide-react";

/**
 * VR Robotics Academy — Books page (new page; existing content untouched).
 * Book covers are placeholders.
 */

const Placeholder = ({ label, tint = "from-blue-500 to-indigo-700", className = "" }: { label: string; tint?: string; className?: string }) => (
  <div className={`relative flex items-center justify-center bg-gradient-to-br ${tint} text-white ${className}`}>
    <div className="flex flex-col items-center gap-1 opacity-90">
      <ImageIcon className="w-8 h-8" />
      <span className="text-xs font-medium text-center px-2">{label}</span>
    </div>
    <span className="absolute top-2 right-2 text-[10px] bg-black/30 px-1.5 py-0.5 rounded">Image placeholder</span>
  </div>
);

const books = [
  { id: "electronics", title: "Electronics for Young Robot Builders", subtitle: "Learn, Create, and Explore", tint: "from-blue-500 to-indigo-700" },
  { id: "advanced-electronics", title: "Advanced Electronics for Young Robot Builders", subtitle: "Master circuits & systems", tint: "from-violet-500 to-purple-700" },
  { id: "autonomous", title: "Autonomous Robot with Arduino", subtitle: "Build smart, self-driving robots", tint: "from-teal-500 to-emerald-700" },
];

const Books = () => {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="bg-gradient-subtle">
        <div className="container-ngo grid lg:grid-cols-2 gap-10 items-center py-16 lg:py-24">
          <div className="space-y-6">
            <p className="text-primary font-semibold uppercase tracking-wide text-sm">VR Robotics Academy Books</p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Master the <span className="text-gradient">Ultimate Skill</span> of the 21st Century
            </h1>
            <p className="text-lg text-muted-foreground">
              Embark on an exciting and enjoyable robotics journey with ease and
              enthusiasm! Dive into the world of robotics and unlock endless
              possibilities while having fun every step of the way.
            </p>
            <Button size="lg" className="bg-gradient-hero border-0" asChild>
              <Link to="/contact" className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Order Now
              </Link>
            </Button>
          </div>
          <Placeholder label="Featured book cover" className="rounded-3xl aspect-[4/3]" />
        </div>
      </section>

      {/* Book list */}
      <section className="section-padding">
        <div className="container-ngo">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">Our Books</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {books.map((b) => (
              <Card key={b.title} id={b.id} className="card-ngo border-0 overflow-hidden flex flex-col scroll-mt-28">
                <Placeholder label="Book cover" tint={b.tint} className="aspect-[3/4]" />
                <CardContent className="p-6 flex-1 flex flex-col">
                  <BookOpen className="w-6 h-6 text-primary mb-3" />
                  <h3 className="font-semibold text-lg">{b.title}</h3>
                  <p className="text-muted-foreground text-sm mt-1 mb-5">{b.subtitle}</p>
                  <Button className="mt-auto bg-gradient-hero border-0" asChild>
                    <Link to="/contact" className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" /> Order Now
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Books;
