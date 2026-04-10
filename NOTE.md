# learn-claude-code-fork 笔记

## npm scripts 生命周期

- `predev` / `postdev` / `prebuild` / `postbuild` 是 npm scripts 的约定，不是 Next.js 特性
- 执行 `npm run <name>` 时，会按 `pre<name> -> <name> -> post<name>` 顺序尝试执行
- 这个项目里 `extract` 不是自动脚本；它之所以会在 `dev` / `build` 前执行，是因为被挂到了 `predev` / `prebuild`
- 所以 `npm run dev` 实际上是 `npm run extract -> next dev`
- 如果直接执行 `next dev`，不会触发 `predev`

## Markdown -> HTML 链路

- 当前仓库不是 `MDX -> React component`，而是 `docs/**/*.md -> docs.json -> DocRenderer -> unified/remark/rehype -> HTML`

**源码位置**

- 源文档：[docs/{en,zh,ja}/*.md](./docs)
- 抽取脚本：[web/scripts/extract-content.ts](./web/scripts/extract-content.ts)
- 生成数据：[web/src/data/generated/docs.json](./web/src/data/generated/docs.json)
- 页面入口：[web/src/app/[locale]/(learn)/[version]/client.tsx](./web/src/app/[locale]/(learn)/[version]/client.tsx)
- 渲染组件：[web/src/components/docs/doc-renderer.tsx](./web/src/components/docs/doc-renderer.tsx)

**每一层在做什么**

- [`docs/{en,zh,ja}/*.md`](./docs)
  文档源文件，内容就是原始 Markdown
- [`web/scripts/extract-content.ts`](./web/scripts/extract-content.ts)
  构建前读取 Markdown 原文，提取 `version / locale / title / content`，写入 `web/src/data/generated/docs.json`
- [`web/src/app/[locale]/(learn)/[version]/client.tsx`](./web/src/app/[locale]/(learn)/[version]/client.tsx)
  在 learn tab 里挂载 `DocRenderer`
- [`web/src/components/docs/doc-renderer.tsx`](./web/src/components/docs/doc-renderer.tsx)
  从 `docs.json` 取出当前文档，把 `content` 从 raw markdown 转成最终 HTML

**`unified` 管线怎么理解**

- `unified` 是管线框架，负责把一串插件按顺序执行
- `remark-*` 处理 Markdown 语义
- `rehype-*` 处理 HTML 语义

这条链的输入输出是：

- Markdown 字符串
- Markdown AST（mdast）
- HTML AST（hast）
- HTML 字符串

当前实际插件顺序是：

- `remarkParse`
  把 Markdown 字符串解析成 Markdown AST
- `remarkGfm`
  给 Markdown AST 增加 GFM 语法支持，比如表格、任务列表、删除线
- `remarkRehype`
  把 Markdown AST 转成 HTML AST
- `rehypeRaw`
  把 Markdown 里保留下来的原始 HTML 并入 HTML AST
- `rehypeHighlight`
  给代码块补高亮 class
- `rehypeStringify`
  把 HTML AST 序列化成 HTML 字符串

一句话记忆：

- `先把 markdown 看懂，再转成 html 结构，再输出 html 字符串`

**项目自己的后处理**

- `postProcessHtml` 不属于标准 Markdown 解析主链
- 它是在 HTML 字符串生成后，再做一层展示层修整
- 目前主要是给代码块补 class / `data-language`、区分 ASCII diagram、处理首个 blockquote 和移除正文 `h1`

**为什么说它不是 MDX**

- 文档源是 `.md`，不是 `.mdx`
- 生成物是 `docs.json`，不是编译后的 React 组件
- `DocRenderer` 最终走的是 `dangerouslySetInnerHTML`
- 依赖里没有 `@next/mdx`、`next-mdx-remote`、`@mdx-js/*`

**实现边界**

- 当前启用了 `remarkRehype({ allowDangerousHtml: true })` 和 `rehypeRaw`
- 这意味着 Markdown 里的原始 HTML 会进入最终渲染
- 现阶段文档来源是仓库内静态文件，风险可控
- 如果以后文档来源改成用户输入或远端 CMS，要重新评估 XSS 风险

## CSS `attr()`

参考：[MDN `attr()`](https://developer.mozilla.org/zh-CN/docs/Web/CSS/Reference/Values/attr)

- `attr()` 读取的是“当前匹配元素”的属性值
- 用在伪元素上时，读取的是伪元素宿主元素的属性值
- 例如 `pre.code-block::before { content: attr(data-language); }` 读的是 `pre.code-block` 自己的 `data-language`
- `content: attr(...)` 是最常见、最稳定的用法
- `attr()` 在 `content` 之外的支持仍偏实验性质，使用时要谨慎
- 不能用 `attr()` 去动态构造 URL
