import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const compile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const React = {
  Fragment: "fragment",
  createElement: (type: unknown, props: any, ...children: any[]) => ({ type, props: props ?? {}, children }),
};
const nodes = (node: any): any[] => !node || typeof node !== "object" ? [] :
  [node, ...node.children.flatMap(nodes)];
const text = (node: any): string => typeof node === "string" ? node :
  node?.children?.map(text).join("") ?? "";
const locale = (lang: string) => JSON.parse(readFileSync(`src/i18n/locales/${lang}.json`, "utf8"));
const translate = (data: any) => (key: string) => key.split(".").reduce((value, part) => value?.[part], data) ?? key;
const app = readFileSync("src/App.tsx", "utf8");
const start = app.lastIndexOf("<div", app.indexOf('className="top-action-grid"'));
const controls = app.slice(start, app.indexOf("{isRiskRenderReady &&", start));

function renderControls(pushEnabled: boolean, showActivityInfo = false) {
  const toggles: boolean[] = [];
  const activityHelp: boolean[] = [];
  const tree = vm.runInNewContext(compile(`const tree = (${controls}); tree;`), {
    React, t: translate(locale("ca")), pushEnabled, onTogglePush: (next: boolean) => toggles.push(next),
    NotificationsInfo: "notifications-info", msgHeat: null, activityEnabled: false,
    activityRequesting: false, activityError: null, showActivityInfo,
    activate() {}, deactivate() {}, setShowActivityInfo: (next: boolean) => activityHelp.push(next),
  });
  return { tree, toggles, activityHelp };
}

test("notification control labels name notifications in all five languages", () => {
  for (const [lang, label] of Object.entries({ ca: "Notificacions", es: "Notificaciones", eu: "Jakinarazpenak", gl: "Notificacións", en: "Notifications" })) {
    const data = locale(lang);
    assert.equal(data.notifications.label, label);
    for (const key of ["info_label", "info_title", "info_body", "info_close"]) {
      assert.equal(typeof data.notifications[key], "string");
      assert.ok(data.notifications[key].length > 0);
    }
  }
});

test("main control preserves both toggle directions and keeps its own help adjacent", () => {
  for (const enabled of [false, true]) {
    const h = renderControls(enabled);
    const wrap = nodes(h.tree).find(node => node.props.className === "push-control-wrap");
    const button = wrap.children.find((node: any) => node.type === "button");
    assert.match(text(button), enabled ? /Notificacions:ACTIVES/ : /Notificacions:DESACTIVADES/);
    assert.ok(wrap.children.some((node: any) => node.type === "notifications-info"));
    button.props.onClick();
    assert.deepEqual(h.toggles, [!enabled]);
  }
});

test("motion information still opens its original independent help without toggling notifications", () => {
  const h = renderControls(false);
  const button = nodes(h.tree).find(node => node.props["aria-label"] === locale("ca").activity.info_label);
  button.props.onClick({ stopPropagation() {} });
  assert.deepEqual(h.activityHelp, [true]);
  assert.deepEqual(h.toggles, []);
  const open = renderControls(false, true);
  const dialog = nodes(open.tree).find(node => node.props.role === "dialog");
  assert.ok(text(dialog).includes(locale("ca").activity.info_body));
  assert.ok(!text(dialog).includes(locale("ca").notifications.info_body));
});

test("notification information opens and closes its own native dialog with the correct explanation", () => {
  for (const lang of ["ca", "es", "eu", "gl", "en"]) {
    const calls: string[] = [];
    const exported: any = {};
    const source = readFileSync("src/components/NotificationsInfo.tsx", "utf8");
    vm.runInNewContext(compile(source), {
      React, exports: exported,
      require: (id: string) => {
        if (id === "react") return { useRef: () => ({ current: {
          showModal: () => calls.push("open"), close: () => calls.push("close"),
        } }) };
        if (id === "react-i18next") return { useTranslation: () => ({ t: translate(locale(lang)) }) };
        throw new Error(`Unexpected dependency: ${id}`);
      },
    });
    const tree = exported.default();
    const all = nodes(tree);
    const opener = all.find(node => node.props["aria-haspopup"] === "dialog");
    assert.equal(opener.props["aria-label"], locale(lang).notifications.info_label);
    opener.props.onClick();
    const dialog = all.find(node => node.type === "dialog");
    assert.ok(text(dialog).includes(locale(lang).notifications.info_body));
    nodes(dialog).find(node => node.type === "button").props.onClick();
    assert.deepEqual(calls, ["open", "close"]);
  }
});
