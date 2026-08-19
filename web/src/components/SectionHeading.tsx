export default function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col items-center gap-5 text-center">
      <p className="text-[12px] font-semibold uppercase leading-none tracking-[0.13em] text-accent-hover">
        {eyebrow}
      </p>
      <h2 className="text-balance text-[34px] font-semibold leading-[1.08em] tracking-[-0.035em] text-ink sm:text-[42px] lg:text-[48px]">
        {title}
      </h2>
      {description && (
        <p className="max-w-[560px] text-balance text-[15px] leading-[1.65em] text-muted">
          {description}
        </p>
      )}
    </div>
  );
}
