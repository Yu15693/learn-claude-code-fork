"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";
import MinimalHeroExample from "@/components/visualizations/minimal-hero-example";

export function MinimalHeroPageClient() {
  const locale = useLocale();

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Minimal Hero Example</h1>
        <p className="max-w-2xl text-sm text-[var(--color-text-secondary)]">
          这是一个最小可运行示例：用静态 SVG 画底图，再用 framer-motion
          给节点高亮、边切换和消息移动补动画。
        </p>
        <div>
          <Link
            href={`/${locale}/timeline`}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Back to timeline
          </Link>
        </div>
      </div>

      <MinimalHeroExample />
    </div>
  );
}
