const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createWindowLayout, COMPACT_SIZE } = require('../src/window-layout');

function fixture(area = { x: 0, y: 0, width: 1440, height: 900 }) {
  let bounds = { x: area.x + 900, y: area.y + 100, width: 420, height: 620 };
  let workArea = area;
  const calls = [], events = [];
  const win = {
    getBounds: () => ({ ...bounds }), setBounds: b => { bounds = b; },
    setMinimumSize: (...v) => calls.push(['min', ...v]),
    setMaximumSize: (...v) => calls.push(['max', ...v]),
    setResizable: v => calls.push(['resizable', v]), focus: () => {}, isDestroyed: () => false,
    webContents: { send: (_channel, event) => events.push(event) },
  };
  return { layout: createWindowLayout(win, { getDisplayMatching: () => ({ workArea }) }),
    bounds: () => bounds, calls, events, area: a => { workArea = a; } };
}

test('minimize fixes native size and docks at the right edge; restore preserves panel bounds', () => {
  const f = fixture(), original = { ...f.bounds() };
  f.layout.setCompact(true);
  assert.deepEqual(f.bounds(), { x: 1368, y: 378, width: COMPACT_SIZE, height: COMPACT_SIZE });
  assert.deepEqual(f.calls.slice(0, 3), [['min', 64, 64], ['max', 64, 64], ['resizable', false]]);
  f.layout.setCompact(true);
  f.layout.setCompact(false);
  assert.deepEqual(f.bounds(), original);
  assert.deepEqual(f.calls.slice(3), [['max', 0, 0], ['min', 320, 420], ['resizable', true]]);
  assert.equal(f.events.length, 2);
});

test('docks on displays with negative origins without jumping to the primary display', () => {
  const f = fixture({ x: -1440, y: -200, width: 1440, height: 900 });
  f.layout.setCompact(true);
  assert.equal(f.bounds().x, -72);
  assert.equal(f.bounds().y, 178);
});

test('screen changes keep compact and expanded windows visible', () => {
  const f = fixture();
  f.layout.setCompact(true);
  f.area({ x: 0, y: 0, width: 800, height: 600 });
  f.layout.refresh();
  assert.equal(f.bounds().x, 728);
  f.layout.setCompact(false);
  assert.deepEqual(f.bounds(), { x: 380, y: 0, width: 420, height: 600 });
});

test('invalid requests do not change geometry', () => {
  const f = fixture();
  f.layout.setCompact('true');
  assert.equal(f.calls.length, 0);
});