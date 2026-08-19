import { getLiveStats, formatCompact } from "@/lib/live-stats";

export default async function Stats() {
  const stats = await getLiveStats();

  const items = [
    {
      value: stats.totalGalleries ? `${formatCompact(stats.totalGalleries)}+` : "677K+",
      label: "Galleries in the archive",
    },
    {
      value: stats.topFavorites ? `${formatCompact(stats.topFavorites)}+` : "—",
      label: "Favorites (this week's top)",
    },
    {
      value: stats.topPages ? `${formatCompact(stats.topPages)}` : "—",
      label: "Pages sampled from top 25",
    },
    {
      value: "Live",
      label: "Fetched from the nHentai API",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-[1200px] px-6 py-12">
      <div className="grid grid-cols-2 gap-y-10 rounded-2xl border border-line bg-surface px-6 py-12 md:grid-cols-4">
        {items.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-2 text-center">
            <span className="text-[22px] font-semibold leading-none text-ink">{stat.value}</span>
            <span className="max-w-[180px] text-[12px] leading-[1.4] text-faint-2">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-faint-2">
        Live figures via the nHentai API {stats.sampled > 0 ? `· sampled ${stats.sampled} galleries` : ""} · refreshed hourly
      </p>
    </section>
  );
}
