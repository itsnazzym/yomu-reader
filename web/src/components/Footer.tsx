import { site } from "@/lib/site-data";

const footerLinks = [
  { label: "Privacy", href: "#" },
  { label: "Contact", href: "#" },
];

export default function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-5 border-t border-line px-6 py-10 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-6">
        {footerLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="rounded-sm text-[14px] font-medium leading-none text-muted transition-colors duration-200 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {link.label}
          </a>
        ))}
      </div>
      <p className="text-center text-[12px] leading-[1.4em] text-faint">
        © 2026 {site.name}. Open source and independent. Licensed under {site.license}. Made for the community.
      </p>
    </footer>
  );
}
