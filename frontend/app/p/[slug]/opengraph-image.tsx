import { ImageResponse } from "next/og";
import { getPublished, SLUG } from "@/lib/published";

export const alt = "Portfolio preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Background, text and accent colours that echo each template.
const palette: Record<string, [string, string, string]> = {
  editorial: ["#f6f1e7", "#1b1a17", "#b3400f"],
  terminal: ["#070b08", "#e6f4ea", "#7ee787"],
  bento: ["#ffd9ec", "#17152b", "#6d3bff"],
  brutalist: ["#ffe24a", "#0a0a0a", "#ff6fb5"],
  blocky: ["#5aaee8", "#ffffff", "#5fb04a"],
  aurora: ["#0b0820", "#ffffff", "#8b5cff"],
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const portfolio = SLUG.test(slug) ? await getPublished(slug) : null;
  const content = portfolio?.published_content;
  const [background, text, accent] = palette[content?.template_id ?? ""] ?? palette.editorial;
  const name = content?.name ?? "Portfolabs";
  const headline = content?.headline ?? "A portfolio, published.";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          width: "100%", height: "100%", padding: 72, background, color: text,
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: accent, fontWeight: 700 }}>portfolabs</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: name.length > 22 ? 84 : 112, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>
            {name}
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 40, lineHeight: 1.25, opacity: 0.85 }}>
            {headline.slice(0, 110)}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.7 }}>{`portfolabs.com/p/${slug}`}</div>
      </div>
    ),
    size,
  );
}
