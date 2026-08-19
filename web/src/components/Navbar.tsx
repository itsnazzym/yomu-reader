"use client";

import { useState } from "react";
import { navLinks, site } from "@/lib/site-data";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-background/95 backdrop-blur-md">
      <nav className="mx-auto flex h-[62px] w-full max-w-[1200px] items-center justify-between px-6">
        {/* Brand */}
        <a href="#" className="flex items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-accent text-[18px] font-bold text-white">
            N
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {site.name}
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="rounded-sm text-[14px] font-medium leading-none text-muted transition-colors duration-200 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/download"
            className="hidden rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold leading-none text-white transition-colors duration-200 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex"
          >
            Download
          </a>
          {/* Mobile menu button */}
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-soft text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile panel */}
      {open && (
        <div className="border-t border-line bg-background px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className="rounded-sm text-[15px] font-medium text-muted transition-colors hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                {link.label}
              </a>
            ))}
            <a
              href="/download"
              onClick={() => setOpen(false)}
              className="inline-flex w-fit rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              Download
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
