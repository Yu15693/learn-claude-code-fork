"use client";

import { useMemo } from "react";
import { useLocale } from "@/lib/i18n";
import docsData from "@/data/generated/docs.json";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

interface DocRendererProps {
  version: string;
}

function renderMarkdown(md: string): string {
  const result = unified()
    // 1. 解析原始 Markdown 字符串，生成 Markdown AST（mdast）
    .use(remarkParse)
    // 2. 在 Markdown 阶段启用 GitHub Flavored Markdown 扩展
    //    例如表格、删除线、任务列表等语法
    .use(remarkGfm)
    // 3. 将 Markdown AST 转成 HTML AST（hast）
    //    allowDangerousHtml: true 表示保留文档里的原始 HTML，交给后续 rehype 处理
    .use(remarkRehype, { allowDangerousHtml: true })
    // 4. 继续解析上一步保留下来的原始 HTML 片段，并合并进 HTML AST
    .use(rehypeRaw)
    // 5. 对代码块做语法高亮，生成带高亮 class 的 HTML 结构
    .use(rehypeHighlight, { detect: false, ignoreMissing: true })
    // 6. 将最终的 HTML AST 序列化成 HTML 字符串
    .use(rehypeStringify)
    // 7. 同步执行整条处理管线：Markdown -> AST -> HTML 字符串
    .processSync(md);
  return String(result);
}

function postProcessHtml(html: string): string {
  // 给高亮后的代码块外层 <pre> 补一个统一 class，并写入 data-language
  // 展示效果：代码块可以在角落显示语言标识，例如 "python"、"ts"
  html = html.replace(
    /<pre><code class="hljs language-(\w+)">/g,
    '<pre class="code-block" data-language="$1"><code class="hljs language-$1">'
  );

  // 给没有语法高亮的 <pre><code> 包一层专用样式 class
  // 展示效果：ASCII 图、纯文本框、流程示意块会按“图示区块”样式渲染，而不是普通代码高亮块
  html = html.replace(
    /<pre><code(?! class="hljs)([^>]*)>/g,
    '<pre class="ascii-diagram"><code$1>'
  );

  // 只把第一段 blockquote 标记成 hero callout
  // 展示效果：文档开头那句核心引导语会被做成更醒目的说明卡片 / 引言区
  html = html.replace(
    /<blockquote>/,
    '<blockquote class="hero-callout">'
  );

  // 移除文档正文里的第一个 h1
  // 展示效果：避免正文标题和页面顶部已有的版本标题重复出现
  html = html.replace(/<h1>.*?<\/h1>\n?/, "");

  // 把 <ol start="N"> 改写成基于 CSS counter-reset 的计数起点
  // 展示效果：如果 markdown 中的有序列表不是从 1 开始，页面上仍能正确显示连续编号
  html = html.replace(
    /<ol start="(\d+)">/g,
    (_, start) => `<ol style="counter-reset:step-counter ${parseInt(start) - 1}">`
  );

  return html;
}

export function DocRenderer({ version }: DocRendererProps) {
  const locale = useLocale();

  const doc = useMemo(() => {
    const match = docsData.find(
      (d: { version: string; locale: string }) =>
        d.version === version && d.locale === locale
    );
    if (match) return match;
    return docsData.find(
      (d: { version: string; locale: string }) =>
        d.version === version && d.locale === "en"
    );
  }, [version, locale]);

  if (!doc) return null;

  const html = useMemo(() => {
    const raw = renderMarkdown(doc.content);
    return postProcessHtml(raw);
  }, [doc.content]);

  return (
    <div className="py-4">
      <div
        className="prose-custom"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
