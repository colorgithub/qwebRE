// 本项目不使用 PostCSS 插件。
// 该空配置用于阻止 Vite 向上查找并误读 D 盘根目录的 postcss.config.mjs（残留的 Tailwind 配置，会导致
// "Cannot find module '@tailwindcss/postcss'" 构建失败）。请勿删除本文件。
export default {};