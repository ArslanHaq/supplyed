const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

function component(file) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module: mod, exports: mod.exports, require(name) {
    if (name === '@/lib/cn') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
    if (name === './Icon') return { Icon: () => React.createElement('svg', { 'aria-hidden': true }) };
    return require(name);
  }});
  return mod.exports;
}
const { Field } = component('components/atoms/Field.tsx');
const { Button } = component('components/atoms/Button.tsx');
const { Checkbox } = component('components/atoms/Checkbox.tsx');
const { Toggle } = component('components/atoms/Toggle.tsx');
const h = React.createElement;
const render = renderToStaticMarkup;

test('Field links a nested control to its visible label and error without altering native validation', () => {
  const html = render(h(Field, { label: 'Email', error: 'Check your email', required: true },
    h('div', null, h('input', { type: 'email', 'aria-describedby': 'existing-help' }))));
  const id = /<input[^>]*\bid="([^"]+)"/.exec(html)[1];
  const errorId = /<div id="([^"]+)"[^>]*role="alert"/.exec(html)[1];
  assert.ok(html.includes(`for="${id}"`));
  assert.ok(html.includes(`aria-describedby="existing-help ${errorId}"`));
  assert.ok(html.includes('aria-invalid="true"'));
  assert.ok(html.includes('aria-required="true"'));
  assert.ok(!html.includes(' required=""'));
});

test('Field preserves explicit target IDs, associates custom controls and leaves unrelated inputs alone', () => {
  const Custom = props => h('button', { ...props, role: 'combobox', type: 'button' }, 'Select');
  const html = render(h(Field, { htmlFor: 'subject', label: 'Subject', hint: 'Choose one' },
    h('input', { id: 'unrelated', type: 'hidden' }),
    h('div', null, h(Custom, { id: 'subject', value: '', onChange() {} }))));
  assert.ok(html.includes('for="subject"'));
  assert.match(html, /<button[^>]*aria-labelledby=/);
  assert.match(html, /<button[^>]*aria-describedby=/);
  assert.ok(!/<input[^>]*aria-labelledby=/.test(html));
});

test('Field IDs stay unique for repeated controls and helper text is suppressed by an error', () => {
  const html = render(h('div', null, ...[1, 2].map(key => h(Field, { key, label: 'Name', hint: 'Help', error: key === 1 ? 'Required' : undefined }, h('input')))));
  const ids = [...html.matchAll(/<input[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, 2);
  assert.equal((html.match(/>Help</g) || []).length, 1);
});

test('Loading buttons expose busy/disabled state and retain both labels for stable layout', () => {
  const html = render(h(Button, { loading: true, loadingLabel: 'Saving changes' }, 'Save'));
  assert.ok(html.includes('aria-busy="true"'));
  assert.ok(html.includes('disabled=""'));
  assert.match(html, /aria-hidden="true"[^>]*invisible[^>]*>Save</);
  assert.ok(html.includes('>Saving changes<'));
  const idle = render(h(Button, { loading: false, loadingLabel: 'Saving changes' }, 'Save'));
  assert.ok(!idle.includes('disabled=""'));
  assert.match(idle, /aria-hidden="true"[^>]*invisible[^>]*>[\s\S]*>Saving changes</);
  assert.ok(idle.includes('justify-items-center'));
});

test('Checkbox and toggle expose native disabled and selected states', () => {
  assert.match(render(h(Checkbox, { checked: true, disabled: true, label: 'Consent' })), /<input[^>]*disabled=""/);
  const toggle = render(h(Toggle, { on: true, disabled: true, label: 'Notifications' }));
  assert.ok(toggle.includes('aria-checked="true"'));
  assert.ok(toggle.includes('role="switch"'));
  assert.ok(toggle.includes('disabled=""'));
});

test('Checkbox preserves native named, required and uncontrolled form semantics', () => {
  const html = render(h(Checkbox, { name: 'consent', value: 'yes', required: true, defaultChecked: true, 'aria-invalid': true, label: 'Agree' }));
  assert.match(html, /<input[^>]*name="consent"/);
  assert.ok(html.includes('value="yes"'));
  assert.ok(html.includes('required=""'));
  assert.ok(html.includes('checked=""'));
  assert.ok(html.includes('aria-invalid="true"'));
});

const { brandPalettes, deriveBrandTheme } = component('lib/theme.ts');
function luminance(hex) {
  const c = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
test('Every preset and pale custom accent keeps readable text on its tint without changing the accent', () => {
  for (const accent of [...brandPalettes.map(p => p.accent), '#ffffff', '#ffff00', '#eeeeee']) {
    const theme = deriveBrandTheme(accent);
    assert.equal(theme.accent, accent);
    const contrast = (luminance(theme.tint) + .05) / (luminance(theme.dark) + .05);
    assert.ok(contrast >= 4.6, `${accent}: ${contrast}`);
  }
  assert.equal(deriveBrandTheme('#008CC4').dark, '#006d99');
});

test('Early theme bootstrap and interactive theme changes derive identical tokens', () => {
  const layout = fs.readFileSync(path.join(__dirname, '..', 'app/layout.tsx'), 'utf8');
  const script = /const themeBootScript = `([\s\S]*?)`;/m.exec(layout)[1];
  for (const accent of [...brandPalettes.map(p => p.accent), '#fff', 'invalid']) {
    const styles = new Map();
    vm.runInNewContext(script, { window: { localStorage: { getItem: () => JSON.stringify({ accent }) } }, document: { documentElement: { style: { setProperty: (key, value) => styles.set(key, value) } } } });
    const theme = deriveBrandTheme(accent);
    for (const [token, key] of [['--se','accent'],['--se-rgb','rgb'],['--se-dark','dark'],['--se-tint','tint'],['--se-tint-2','tint2']]) assert.equal(styles.get(token), theme[key], `${accent} ${token}`);
  }
});
