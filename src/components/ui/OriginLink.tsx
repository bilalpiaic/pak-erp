"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type OriginLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
};

/** Screen navigation link; prints as plain underlined text. */
export function OriginLink({ href, children, className = "", title }: OriginLinkProps) {
  return (
    <Link
      href={href}
      title={title}
      className={`origin-link text-[var(--accent)] underline-offset-2 hover:underline ${className}`}
    >
      {children}
    </Link>
  );
}
