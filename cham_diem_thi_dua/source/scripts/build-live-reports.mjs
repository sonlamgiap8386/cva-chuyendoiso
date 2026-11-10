import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, resolve } from 'node:path';
import { build } from 'esbuild';
import ts from 'typescript';

// The deployed app uses its original React instance. Compile only report code into its assets directory.
const source = fileURLToPath(new URL('../', import.meta.url));
const assets = resolve(source, '../assets');
const reportEntry = 'ExportPdfModal-B2gRiwCB.js';
const reactEntry = './react-vendor-DBuJbkU2.js';
const reportView = 'ReportsView-DIzCzHD0.js';
const monthlyView = 'MonthlyScoringTable-Dxb2NxUl.js';
const personalView = 'ScoringModal-VP5goaqu.js';
const readAsset = name => readFile(resolve(assets, name), 'utf8');

function replaceOnce(code, before, after) {
  if (!code.includes(before) && code.split(after).length === 2) return code;
  assert.equal(code.split(before).length, 2, `Unexpected deployed report anchor: ${before}`);
  return code.replace(before, () => after);
}

function personalPrint(code) {
  if (code.includes('Tải Word A4')) return code;
  const ast = ts.createSourceFile(personalView, code, ts.ScriptTarget.Latest, true);
  const grids = [];
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const style = node.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'className');
      if (style?.initializer.text === 'grid grid-cols-3 gap-4 pt-6 text-center text-xs') grids.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(grids.length, 1, 'Could not identify the signature grid in the deployed personal print view.');
  const props = grids[0];
  const style = props.properties.find(p => p.name.getText(ast) === 'className').initializer;
  const signatures = props.properties.find(p => p.name.getText(ast) === 'children').initializer;
  assert.equal(signatures.elements.length, 3);
  const approval = signatures.elements[2];
  assert.ok(approval.getText(ast).includes('HIỆU TRƯỞNG PHÊ DUYỆT'));
  assert.ok(code.includes('P=j.role==="bgh"') && code.includes('$=j.role==="ttcm"'));
  for (const [node, replacement] of [[approval, `(P||$)&&${approval.getText(ast)}`],
    [style, '(P||$)?"grid grid-cols-3 gap-4 pt-6 text-center text-xs":"grid grid-cols-2 gap-4 pt-6 text-center text-xs"']]) {
    code = code.slice(0, node.getStart(ast)) + replacement + code.slice(node.getEnd());
  }
  const button = 'e.jsx("button",{type:"button",className:"px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50",' +
    'onClick:async t=>{const button=t.currentTarget;button.disabled=true;try{' +
    `const {downloadPersonalScoreWord}=await import("./${reportEntry}");await downloadPersonalScoreWord(i,j)` +
    '}catch{window.alert("Không tạo được tệp Word. Vui lòng thử lại.")}finally{button.disabled=false}},children:"Tải Word A4"}),';
  return replaceOnce(code, 'e.jsxs("button",{onClick:Ie,', button + 'e.jsxs("button",{onClick:Ie,');
}

const [report, monthly, personal] = await Promise.all([reportView, monthlyView, personalView].map(readAsset));
const reportText = 'Tải báo cáo thi đua dạng Word khổ A4 để chỉnh sửa trước khi in';
const updates = new Map([
  [reportView, replaceOnce(replaceOnce(report, 'Xuất PDF ', 'Xuất Word '),
    'Xuất bảng điểm ra định dạng PDF chính quy kèm con dấu & chữ ký Ban Giám Hiệu', reportText)],
  [monthlyView, replaceOnce(replaceOnce(monthly, 'Xuất PDF ', 'Xuất Word '),
    'Xuất bảng điểm ra định dạng PDF chính quy có biểu mẫu chuyên nghiệp & hỗ trợ ký tên Ban Giám Hiệu', reportText)],
  [personalView, personalPrint(personal)],
]);

const result = await build({
  absWorkingDir: source,
  entryPoints: [{ in: 'live-report-entry', out: reportEntry.replace(/\.js$/, '') }],
  outdir: assets,
  bundle: true, splitting: true, write: false, metafile: true, minify: true,
  platform: 'browser', format: 'esm', target: 'es2022', jsx: 'automatic', chunkNames: 'report-[name]-[hash]',
  plugins: [{
    name: 'deployed-react',
    setup(plugin) {
      plugin.onResolve({ filter: /^live-report-entry$/ }, args => ({ path: args.path, namespace: 'live-report' }));
      plugin.onLoad({ filter: /.*/, namespace: 'live-report' }, () => ({
        contents: `export { ExportWordModal as E } from './src/components/ExportWordModal';
          export async function downloadPersonalScoreWord(record, user) {
            const report = await import('./src/utils/reportWord');
            return report.downloadPersonalScoreWord(record, user);
          }`,
        resolveDir: source,
      }));
      plugin.onResolve({ filter: /^deployed-react-vendor$/ }, () => ({ path: reactEntry, external: true }));
      // docx uses the native atob in browsers. Its fallback to Node's buffer is unreachable here.
      plugin.onResolve({ filter: /^buffer$/ }, () => ({ path: 'buffer', namespace: 'browser-only' }));
      plugin.onLoad({ filter: /^buffer$/, namespace: 'browser-only' }, () => ({ contents: 'module.exports = {};' }));
      plugin.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, args => ({ path: args.path, namespace: 'deployed-react' }));
      plugin.onLoad({ filter: /.*/, namespace: 'deployed-react' }, args => ({
        contents: args.path === 'react'
          ? 'import {r} from "deployed-react-vendor"; export default r; export const {useState,useMemo,useRef,createElement,forwardRef}=r;'
          : 'import {j} from "deployed-react-vendor"; export const {jsx,jsxs,Fragment}=j;',
      }));
    },
  }],
});

assert.ok(!Object.keys(result.metafile.inputs).some(path => /(?:firebase|\/src\/App\.tsx|\/react\/index\.js)/i.test(path)));
for (const file of result.outputFiles) {
  const name = basename(file.path);
  assert.ok(name === reportEntry || /^report-[\w-]+\.js$/.test(name));
  updates.set(name, file.contents);
}
for (const [name, contents] of updates) {
  await writeFile(resolve(assets, name), contents);
  console.log(name);
}
