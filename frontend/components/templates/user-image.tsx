import { safeImage } from "@/lib/portfolio";

/**
 * A portfolio owner's image. The server already resized and re-encoded it when it
 * was uploaded, so the Next.js image optimizer isn't needed here.
 */
export function UserImage({
  src,
  alt = "",
  className,
  priority = false,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  const safe = safeImage(src);
  if (!safe) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={safe} alt={alt} className={className} loading={priority ? "eager" : "lazy"} decoding="async" />
  );
}
