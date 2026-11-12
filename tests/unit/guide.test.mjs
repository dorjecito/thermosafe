import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const langs = ['ca', 'es', 'eu', 'gl', 'en'];
const read = path => readFileSync(path, 'utf8');
const locales = Object.fromEntries(langs.map(lang => [lang, JSON.parse(read(`src/i18n/locales/${lang}.json`))]));
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name.endsWith('.css') ? {} : imports[name] ?? require(name) });
  return exports;
}
function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)]));
  assert.equal(typeof value, 'string');
  assert.ok(value.trim());
  assert.doesNotMatch(value, /guide\.|TODO|TBD/);
  return 'string';
}
for (const lang of langs) {
  test(`guide ${lang}: complete translations, render, eleven stable sections and working anchors`, async () => {
    assert.deepEqual(shape(locales[lang].guide), shape(locales.ca.guide));
    const i18n = createInstance();
    await i18n.init({ lng: lang, fallbackLng: false, resources: { [lang]: { translation: locales[lang] } } });
    const { default: GuidePage, GUIDE_SECTIONS } = load('src/pages/GuidePage.tsx', { 'react-i18next': { useTranslation: () => ({ t: i18n.t.bind(i18n), i18n }) } });
    assert.equal(GUIDE_SECTIONS.length, 11);
    assert.equal(locales[lang].guide.sections.faq.blocks.length, 8);
    const html = renderToStaticMarkup(React.createElement(GuidePage));
    assert.equal((html.match(/<h1/g) || []).length, 1);
    for (const [, id] of GUIDE_SECTIONS) assert.ok(html.includes(`id="${id}"`));
    for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${match[1]}"`), match[1]);
    assert.ok(html.includes('href="/"'));
    assert.doesNotMatch(html, /guide\.(?:sections|title|safety|back)/);
    assert.ok(html.includes(locales[lang].guide.safety.replaceAll("'", '&#x27;')));
  });
}
test('Vercel guide rewrites are narrow and sitemap contains canonical URL', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.deepEqual(config.rewrites, [
    { source: '/guia', destination: '/index.html' },
    { source: '/guia/', destination: '/index.html' },
  ]);
  assert.match(read('public/sitemap.xml'), /<loc>https:\/\/thermosafe.app\/guia<\/loc>/);
});
test('information link is separate; 112 confirmation still gates tel:112', () => {
  const calls = [];
  const nav = { location: { href: '' }, confirm: () => { calls.push('confirm'); return false; } };
  const source = ts.transpileModule(read('src/components/SafetyActions.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const fakeReact = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useState: () => ['', () => {}] };
  vm.runInNewContext(source, { exports, window: nav, require: name => name === 'react' ? { default: fakeReact, ...fakeReact } : name === 'react-i18next' ? { useTranslation: () => ({ t: key => key }) } : { getUvLevelIndex: () => 0 } });
  const tree = exports.default({ lang: 'ca', risk: 'safe', uvi: 0, windRisk: 'none' });
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...node.children.flatMap(nodes)];
  const controls = nodes(tree);
  const emergency = controls.find(node => node.props.className === 'safety-112-btn');
  emergency.props.onClick();
  assert.equal(nav.location.href, '');
  nav.confirm = () => true;
  emergency.props.onClick();
  assert.equal(nav.location.href, 'tel:112');
  assert.equal(calls.length, 1);
  assert.equal(controls.find(node => node.props.className === 'safety-info-link').props.href, '/guia');
  assert.equal(typeof controls.find(node => node.props.className === 'safety-share-btn').props.onClick, 'function');
});
