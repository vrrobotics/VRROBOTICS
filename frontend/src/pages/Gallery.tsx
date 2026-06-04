import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ImageIcon, PlayCircle, Calendar, X, Images } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * VR Robotics Academy — public Gallery page (Home → Gallery).
 * Live data from admin-service: GET /api/public/gallery. Admins add/manage
 * these under Admin → Gallery → Add/Manage Gallery, and anything saved as
 * Active replicates here automatically. No hardcoded items, so the page always
 * reflects real admin content.
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

type Filter = "all" | "image" | "video";

const formatDate = (raw: string | null) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  // "AUG 18, 2024" — uppercase month to match the card style.
  return d
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
};

const Placeholder = ({ className = "" }: { className?: string }) => (
  <div
    className={`relative flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 text-primary ${className}`}
  >
    <ImageIcon className="w-10 h-10 opacity-70" />
  </div>
);

const DatePill = ({ date }: { date: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 backdrop-blur px-3 py-1 text-xs font-semibold text-primary shadow-sm">
    <Calendar className="w-3.5 h-3.5" />
    {date}
  </span>
);

const Gallery = () => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${ADMIN_BASE}/api/public/gallery`, {
          timeout: 30000,
          // Bypass the browser's HTTP cache so newly added admin items show
          // immediately instead of a stale 304 Not Modified response.
          params: { t: Date.now() },
          headers: { "Cache-Control": "no-cache" },
        });
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Use the first video as the feature, the rest become the grid.
  const feature = useMemo(
    () => items.find((i) => i.media_type === "video" && i.media_url),
    [items],
  );

  const counts = useMemo(
    () => ({
      all: items.length,
      image: items.filter((i) => i.media_type === "image").length,
      video: items.filter((i) => i.media_type === "video").length,
    }),
    [items],
  );

  const cards = useMemo(() => {
    const rest = items.filter((i) => i !== feature);
    if (filter === "all") return rest;
    return rest.filter((i) => i.media_type === filter);
  }, [items, feature, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "image", label: "Photos" },
    { key: "video", label: "Videos" },
  ];

  return (
    <div className="overflow-hidden bg-gradient-subtle">
      <section className="section-padding">
        <div className="container-ngo">
          {/* Header */}
          <div className="text-center space-y-4 mb-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-primary">
              <Images className="w-4 h-4" />
              VR Robotics Academy
            </span>
            <h1 className="text-4xl md:text-5xl font-bold">
              Our <span className="text-gradient">Gallery</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Moments from our events, competitions, and classrooms — see what
              learning the future looks like.
            </p>

            {/* Filter pills — only render when there's more than one media type */}
            {!loading && counts.image > 0 && counts.video > 0 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                      filter === f.key
                        ? "bg-gradient-hero text-white shadow-md"
                        : "bg-white text-muted-foreground border border-border/60 hover:border-primary/40 hover:text-primary"
                    }`}
                  >
                    {f.label}
                    <span className="ml-1.5 opacity-70">{counts[f.key]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Feature video */}
          {feature?.media_url && filter !== "image" && (
            <div className="relative rounded-3xl overflow-hidden aspect-video mb-12 shadow-card ring-1 ring-primary/10">
              <iframe
                title={feature.title}
                src={feature.media_url}
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card-ngo border-0">
                  <Skeleton className="w-full h-56" />
                  <div className="p-5 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Gallery coming soon</h3>
              <p className="text-muted-foreground text-sm mt-1">
                New photos and videos from our events will appear here.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((it) => {
                const date = formatDate(it.event_date);
                const isVideo = it.media_type === "video";
                const clickable = !isVideo && !!it.media_url;
                return (
                  <article
                    key={it.id}
                    onClick={() => clickable && setLightbox(it)}
                    className={`card-ngo group border-0 flex flex-col ${
                      clickable ? "cursor-pointer" : ""
                    }`}
                  >
                    {/* Media */}
                    <div className="relative overflow-hidden">
                      {it.media_url ? (
                        isVideo ? (
                          <iframe
                            title={it.title}
                            src={it.media_url}
                            className="w-full h-56"
                            allowFullScreen
                          />
                        ) : (
                          <img
                            src={it.media_url}
                            alt={it.title}
                            className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        )
                      ) : (
                        <Placeholder className="h-56" />
                      )}

                      {/* Overlays (images only — videos own their controls) */}
                      {!isVideo && (
                        <>
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          {date && (
                            <div className="absolute top-3 left-3">
                              <DatePill date={date} />
                            </div>
                          )}
                        </>
                      )}
                      {isVideo && (
                        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-sm">
                          <PlayCircle className="w-3.5 h-3.5" />
                          Video
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-1.5 flex-1">
                      <h3 className="font-semibold text-lg leading-snug group-hover:text-primary transition-colors">
                        {it.title}
                      </h3>
                      {it.description && (
                        <p className="text-muted-foreground text-sm line-clamp-2">
                          {it.description}
                        </p>
                      )}
                      {!isVideo && date && (
                        <p className="text-warm-green text-xs font-semibold pt-1">
                          {date}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox for images */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-0 bg-transparent shadow-none">
          {lightbox && (
            <div className="rounded-2xl overflow-hidden bg-card">
              <button
                onClick={() => setLightbox(null)}
                className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-foreground shadow hover:bg-white transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={lightbox.media_url ?? ""}
                alt={lightbox.title}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
              <div className="p-5 space-y-1.5">
                {formatDate(lightbox.event_date) && (
                  <p className="text-warm-green text-xs font-semibold">
                    {formatDate(lightbox.event_date)}
                  </p>
                )}
                <h3 className="font-semibold text-xl">{lightbox.title}</h3>
                {lightbox.description && (
                  <p className="text-muted-foreground text-sm">
                    {lightbox.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gallery;
