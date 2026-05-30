import { useEffect, useState } from "react";
import axios from "axios";
import { ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * VR Robotics Academy — public Gallery page (Home → Gallery).
 * Live data from admin-service: GET /api/public/gallery. Admins add/manage
 * these under Admin → Gallery → Add/Manage Gallery, and anything saved as
 * Active replicates here automatically. Falls back to nothing-but-header when
 * empty (no hardcoded items, so the page reflects real admin content).
 */

const ADMIN_BASE =
  (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:5000";

interface GalleryItem {
  id: number;
  title: string;
  description: string | null;
  media_type: "image" | "video";
  media_url: string | null;
  event_date: string | null;
}

const Placeholder = ({ className = "" }: { className?: string }) => (
  <div className={`relative flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-white ${className}`}>
    <ImageIcon className="w-8 h-8 opacity-80" />
  </div>
);

const Gallery = () => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${ADMIN_BASE}/api/public/gallery`, { timeout: 30000 });
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Use the first video as the feature, the rest as cards.
  const feature = items.find((i) => i.media_type === "video" && i.media_url);
  const cards = items.filter((i) => i !== feature);

  return (
    <div className="overflow-hidden">
      <section className="section-padding">
        <div className="container-ngo">
          <div className="text-center space-y-3 mb-10">
            <p className="text-primary font-semibold uppercase tracking-wide text-sm">VR Robotics Academy</p>
            <h1 className="text-4xl md:text-5xl font-bold">Gallery</h1>
            <p className="text-muted-foreground">Moments from our events, competitions, and classrooms.</p>
          </div>

          {/* Feature video — only shown when an actual video has been uploaded
              in the admin panel. No placeholder otherwise. */}
          {feature?.media_url && (
            <div className="rounded-3xl overflow-hidden aspect-video mb-12 shadow-card">
              <iframe title={feature.title} src={feature.media_url} className="w-full h-full" allowFullScreen />
            </div>
          )}

          {loading ? (
            <p className="text-center text-muted-foreground py-10">Loading gallery…</p>
          ) : cards.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Gallery coming soon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((it) => (
                <Card key={it.id} className="card-ngo border-0 overflow-hidden">
                  {it.media_url ? (
                    it.media_type === "video" ? (
                      <iframe title={it.title} src={it.media_url} className="w-full h-52" allowFullScreen />
                    ) : (
                      <img src={it.media_url} alt={it.title} className="w-full h-52 object-cover" loading="lazy" />
                    )
                  ) : (
                    <Placeholder className="h-52" />
                  )}
                  <CardContent className="p-5 space-y-1">
                    {it.event_date && <p className="text-warm-green text-xs font-semibold">{it.event_date}</p>}
                    <h3 className="font-semibold text-lg">{it.title}</h3>
                    {it.description && <p className="text-muted-foreground text-sm">{it.description}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Gallery;
