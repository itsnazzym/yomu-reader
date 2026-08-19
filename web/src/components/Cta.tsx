import Image from "next/image";
import { platforms, site } from "@/lib/site-data";
import { ArrowIcon } from "@/components/icons";

export default function Cta() {
  return (
    <section id="download" className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-6 py-24">
      <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-line bg-surface px-6 py-16 text-center sm:py-20">
        {/* Real mascot peeking from the bottom corner */}
        <div className="pointer-events-none absolute -bottom-10 -right-6 hidden h-56 w-56 select-none opacity-80 sm:block">
          <Image
            src="/mascot.jpg"
            alt=""
            aria-hidden
            fill
            sizes="224px"
            className="object-contain"
          />
        </div>

        <p className="text-[12px] font-semibold uppercase leading-none tracking-[0.13em] text-accent-hover">
          Available when you are
        </p>
        <h2 className="text-balance text-[34px] font-semibold leading-[1.08em] tracking-[-0.035em] text-ink sm:text-[44px]">
          Ready to try it?
        </h2>
        <p className="max-w-[480px] text-balance text-[15px] leading-[1.65em] text-muted">
          Get the unofficial app and enjoy a cleaner, faster way to manage your library.
        </p>

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="/download"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-[14px] font-semibold leading-none text-white transition-colors duration-200 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Download
            <ArrowIcon />
          </a>
          <a
            href={site.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface-2 px-7 py-3.5 text-[14px] font-semibold leading-none text-ink transition-colors duration-200 hover:border-line-soft-2 hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            GitHub
          </a>
        </div>

        <div className="mt-4 flex flex-col items-center gap-4">
          <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.13em] text-faint-2">
            Supported Platforms
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {platforms.map((platform) => (
              <span
                key={platform}
                className="rounded-full border border-line-soft bg-surface-4 px-4 py-2 text-[13px] font-medium leading-none text-ink"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
