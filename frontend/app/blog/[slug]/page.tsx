import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle } from "../../../lib/articles";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      publishedTime: article.date,
    },
  };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <div className="section-pad mx-auto max-w-3xl py-12">
      <Link href="/blog" className="text-sm font-semibold text-brand hover:text-cyan-glow">
        ← All guides
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">{article.title}</h1>
      <p className="mt-2 text-xs uppercase tracking-widest text-secondary/70">
        {article.date} · {article.minutes} min read
      </p>
      <p className="mt-4 text-lg text-secondary">{article.description}</p>
      <div className="mt-10 space-y-8">
        {article.body.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-bold text-white">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-3 leading-relaxed text-secondary">
                {paragraph}
              </p>
            ))}
            {section.steps && (
              <ol className="mt-4 space-y-2">
                {section.steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 text-sm text-white">
                    <span className="pill-flow mt-0.5 border-brand/50 text-brand">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
      <div className="glass mt-12 p-6 text-center">
        <p className="font-semibold">Ready to try it?</p>
        <Link href="/" className="btn-primary mt-3 inline-block">
          Paste a video link
        </Link>
      </div>
    </div>
  );
}
