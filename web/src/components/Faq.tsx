"use client";

import { useState } from "react";
import SectionHeading from "@/components/SectionHeading";
import { faqs } from "@/lib/site-data";

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto w-full max-w-[760px] scroll-mt-20 px-6 py-24">
      <SectionHeading
        eyebrow="Good to Know"
        title="Questions, answered."
        description="The essentials about this independent, open source project."
      />

      <div className="mt-14 flex flex-col gap-3">
        {faqs.map((faq, i) => {
          const open = openIndex === i;
          return (
            <div
              key={faq.question}
              className={`overflow-hidden rounded-lg border transition-colors duration-200 ${
                open ? "border-line-soft-3 bg-surface-4" : "border-line bg-surface-4"
              }`}
            >
              <button
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 rounded-lg px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  className={`text-[15px] font-medium leading-[1.35em] transition-colors duration-200 ${
                    open ? "text-ink" : "text-muted"
                  }`}
                >
                  {faq.question}
                </span>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-transform duration-200 ${
                    open
                      ? "rotate-45 border-[#2e2e2e] bg-[#191919] text-accent"
                      : "border-[#2e2e2e] bg-[#191919] text-accent"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
              {open && (
                <div className="px-5 pb-5">
                  <p className="text-[14px] leading-[1.6em] text-muted">{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
