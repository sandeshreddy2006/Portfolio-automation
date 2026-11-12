import { imageFramingStyle } from "@/lib/image";
import { safeImage, type ImageFraming } from "@/lib/portfolio";
import styles from "./user-image.module.css";

/** Owner uploads are resized and re-encoded by the backend. */
export function UserImage({
  src,
  alt = "",
  className,
  priority = false,
  framing,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  priority?: boolean;
  framing?: ImageFraming | null;
}) {
  const safe = safeImage(src);
  if (!safe) return null;

  if (!framing) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={safe} alt={alt} className={className} loading={priority ? "eager" : "lazy"} decoding="async" />;
  }

  return (
    <span className={[styles.frame, className].filter(Boolean).join(" ")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={safe} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" style={imageFramingStyle(framing)} />
    </span>
  );
}
