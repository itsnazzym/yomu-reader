import SectionHeading from "@/components/SectionHeading";
import { FeatureIcon } from "@/components/icons";
import { features } from "@/lib/site-data";

export default function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-6 py-24">
      <SectionHeading
        eyebrow="Designed with Intent"
        title="Everything you need. Nothing you don't."
        description="A focused toolkit for keeping your personal library organized, portable and entirely yours."
      />

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 transition-colors duration-200 hover:border-line-soft-3"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-accent-hover">
              <FeatureIcon name={feature.icon} />
            </span>
            <h3 className="text-[18px] font-semibold leading-[1.25em] tracking-[-0.01em] text-ink">
              {feature.title}
            </h3>
            <p className="text-[15px] leading-[1.65em] text-muted">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
