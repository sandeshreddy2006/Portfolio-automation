import Image from "next/image";

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      className={compact ? "brand brand--compact" : "brand"}
      src="/brand/logo.svg"
      alt="Portfolabs"
      width={245}
      height={48}
      loading={compact ? "eager" : "lazy"}
    />
  );
}
