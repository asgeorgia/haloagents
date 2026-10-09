const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUpdateScheduler, DAY, RETRY } = require('../src/update-scheduler');

function fixture(check = async () => {}) {
  let time = 100000000;
  let stored = 0;
  let calls = 0;
  const make = () => createUpdateScheduler({
    check: async () => { calls++; await check(); }, now: () => time,
    readLastCheck: () => stored, writeLastCheck: (n) => { stored = n; },
  });
  return { make, advance: (n) => { time += n; }, calls: () => calls, stored: () => stored };
}

test('checks on first launch, waits a day, and remembers checks across launches', async () => {
  const f = fixture();
  const first = f.make();
  assert.equal(await first.run(), true);
  assert.equal(await f.make().run(), false);
  f.advance(DAY - 1);
  assert.equal(await first.run(), false);
  f.advance(1);
  assert.equal(await first.run(), true);
  assert.equal(f.calls(), 2);
});

test('manual check bypasses daily interval', async () => {
  const f = fixture(); const scheduler = f.make();
  await scheduler.run(); await scheduler.run(true);
  assert.equal(f.calls(), 2);
});

test('offline failures retry in one hour without recording a successful check', async () => {
  const f = fixture(async () => { throw new Error('offline'); }); const scheduler = f.make();
  assert.equal(await scheduler.run(), false);
  assert.equal(f.stored(), 0);
  await scheduler.run(); assert.equal(f.calls(), 1);
  f.advance(RETRY); await scheduler.run(); assert.equal(f.calls(), 2);
});

test('concurrent checks do not overlap', async () => {
  let finish;
  const f = fixture(() => new Promise((resolve) => { finish = resolve; })); const scheduler = f.make();
  const pending = scheduler.run();
  assert.equal(await scheduler.run(true), false);
  finish(); await pending; assert.equal(f.calls(), 1);
});

test('clock moving backwards does not postpone checks indefinitely', async () => {
  const f = fixture(); const scheduler = f.make(); await scheduler.run();
  f.advance(-DAY); assert.equal(await scheduler.run(), true);
});