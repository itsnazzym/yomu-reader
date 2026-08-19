import { qualityChips, site } from "@/lib/site-data";
import { ArrowIcon, CheckIcon } from "@/components/icons";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, rgba(237,37,83,0.14), rgba(237,37,83,0.05) 55%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-center gap-14 px-6 pb-24 pt-28">
        <div className="flex max-w-[860px] flex-col items-center gap-6 text-center">
          {/* Badge */}
          <div className="flex items-center gap-2 rounded-full border border-line-soft-2 bg-surface-2 px-3.5 py-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[12px] font-semibold uppercase leading-none tracking-[0.13em] text-accent-hover">
              Unofficial • Open Source
            </span>
          </div>

          {/* H1 */}
          <h1 className="text-balance text-[48px] font-bold leading-[1.02em] tracking-[-0.045em] text-ink sm:text-[64px] lg:text-[76px]">
            {site.tagline}
          </h1>

          {/* Subtitle */}
          <p className="max-w-[620px] text-balance text-[17px] font-normal leading-[1.6em] tracking-[-0.005em] text-muted sm:text-[19px]">
            {site.description}
          </p>

          {/* CTAs */}
          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="/download"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-[14px] font-semibold leading-none text-white transition-colors duration-200 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Download the App
              <ArrowIcon />
            </a>
            <a
              href={site.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface px-7 py-3.5 text-[14px] font-semibold leading-none text-ink transition-colors duration-200 hover:border-line-soft-2 hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              View on GitHub
            </a>
          </div>

          {/* Disclaimer */}
          <p className="mt-1 text-[12px] leading-[1.4em] text-faint-2">{site.disclaimer}</p>
        </div>

        {/* Quality chips */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {qualityChips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-[7px] rounded-full border border-line-soft bg-surface px-3 py-2 text-[12px] font-medium leading-none text-muted"
            >
              <CheckIcon />
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
