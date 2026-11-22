export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section-pad max-w-3xl py-12">
      <h1 className="text-3xl font-extrabold sm:text-4xl">
        {title.split(" ").slice(0, -1).join(" ")} <span className="gradient-text">{title.split(" ").slice(-1)}</span>
      </h1>
      <div className="glass mt-8 space-y-4 p-6 text-sm leading-relaxed text-secondary sm:p-8">{children}</div>
    </div>
  );
}
