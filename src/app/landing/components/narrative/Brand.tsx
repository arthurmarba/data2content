import Image from "next/image";
import Link from "next/link";

export function Brand({ priority = false }: { priority?: boolean }) {
  return (
    <Link className="d2c-brand" href="/" aria-label="Data2Content - página inicial">
      <span className="d2c-brand__mark">
        <Image
          src="/images/Colorido-Simbolo.png"
          alt=""
          fill
          sizes="32px"
          className="d2c-brand__image"
          priority={priority}
        />
      </span>
      <span>data2content</span>
    </Link>
  );
}
