import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, BookOpen, ImageIcon } from "lucide-react";

/**
 * VR Robotics Academy — public Books page (Home → Books).
 * Live data from admin-service: GET /api/public/books. Admins add/manage
 * these under Admin → Books → Add/Manage Books, and anything saved as Active
 * replicates here automatically. No hardcoded books, so the page always
 * reflects real admin content.
 */

const ADMIN_BASE =
  (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:5000";

interface Book {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_url: string | null;
  buy_url: string | null;
}

const TINTS = [
  "from-blue-500 to-indigo-700",
  "from-violet-500 to-purple-700",
  "from-teal-500 to-emerald-700",
  "from-orange-500 to-rose-600",
];

const Placeholder = ({
  label,
  tint = "from-blue-500 to-indigo-700",
  className = "",
}: {
  label: string;
  tint?: string;
  className?: string;
}) => (
  <div
    className={`relative flex items-center justify-center bg-gradient-to-br ${tint} text-white ${className}`}
  >
    <div className="flex flex-col items-center gap-1 opacity-90">
      <ImageIcon className="w-8 h-8" />
      <span className="text-xs font-medium text-center px-2">{label}</span>
    </div>
  </div>
);

const Books = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${ADMIN_BASE}/api/public/books`, {
          timeout: 30000,
          // Bypass the browser HTTP cache so newly added admin books show
          // immediately instead of a stale 304 Not Modified response.
          params: { t: Date.now() },
          headers: { "Cache-Control": "no-cache" },
        });
        if (!cancelled) setBooks(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setBooks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = books[0];

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="bg-gradient-subtle">
        <div className="container-ngo grid lg:grid-cols-2 gap-10 items-center py-16 lg:py-24">
          <div className="space-y-6">
            <p className="text-primary font-semibold uppercase tracking-wide text-sm">
              VR Robotics Academy Books
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Master the <span className="text-gradient">Ultimate Skill</span> of
              the 21st Century
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
          {featured?.cover_url ? (
            <img
              src={featured.cover_url}
              alt={featured.title}
              className="rounded-3xl aspect-[4/3] w-full object-cover shadow-card"
            />
          ) : (
            <Placeholder
              label="Featured book cover"
              className="rounded-3xl aspect-[4/3]"
            />
          )}
        </div>
      </section>

      {/* Book list */}
      <section className="section-padding">
        <div className="container-ngo">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">
            Our Books
          </h2>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card-ngo border-0 overflow-hidden">
                  <Skeleton className="w-full aspect-[3/4]" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Books coming soon</h3>
              <p className="text-muted-foreground text-sm mt-1">
                New titles from VR Robotics Academy will appear here.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {books.map((b, i) => (
                <article
                  key={b.id}
                  className="card-ngo-static border-0 rounded-2xl overflow-hidden flex flex-col h-full group transition-transform duration-300 hover:-translate-y-1 scroll-mt-28"
                >
                  {/* Cover — the focal point. Fixed 3:4 ratio so every card
                      lines up regardless of the uploaded image's dimensions. */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                    {b.cover_url ? (
                      <img
                        src={b.cover_url}
                        alt={b.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <Placeholder
                        label="Book cover"
                        tint={TINTS[i % TINTS.length]}
                        className="w-full h-full"
                      />
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {b.title}
                    </h3>
                    {b.subtitle && (
                      <p className="text-primary/90 text-sm font-medium mt-1 line-clamp-1">
                        {b.subtitle}
                      </p>
                    )}
                    {b.description && (
                      <p className="text-muted-foreground text-sm mt-2 leading-relaxed line-clamp-2">
                        {b.description}
                      </p>
                    )}
                    {/* Spacer keeps the button pinned to the bottom even when a
                        book has no subtitle/description, so all cards align. */}
                    <div className="flex-1" />
                    <Button className="mt-4 w-full bg-gradient-hero border-0" asChild>
                      {b.buy_url ? (
                        <a
                          href={b.buy_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2"
                        >
                          <ShoppingCart className="w-4 h-4" /> Order Now
                        </a>
                      ) : (
                        <Link to="/contact" className="flex items-center justify-center gap-2">
                          <ShoppingCart className="w-4 h-4" /> Order Now
                        </Link>
                      )}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Books;
