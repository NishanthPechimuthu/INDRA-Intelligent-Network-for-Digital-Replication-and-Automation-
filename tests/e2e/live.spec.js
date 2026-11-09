import { test, expect } from '@playwright/test';
import { boot, getFactory } from './helpers.js';

const errors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const list = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page) || [], 'uncaught browser errors').toEqual([]);
});

function live(page) {
  return page.evaluate(() => window.__INDRA__.getLive());
}

test('step mode advances the shared live engine and previous rewinds it', async ({ page }) => {
  await boot(page);
  await expect(page.getByTestId('live-state')).toContainText('IDLE');
  await expect(page.getByTestId('live-start')).toBeVisible();

  await page.getByTestId('live-step').click();
  await expect.poll(async () => (await live(page))?.operationSeq || 0).toBeGreaterThan(0);

  const first = await live(page);
  expect(first.elapsed).toBeGreaterThan(0);
  expect(first.products.length).toBeGreaterThan(0);
  expect(first.stations.some((station) => station.state !== 'off-shift')).toBeTruthy();
  await expect(page.getByTestId('live-state')).toContainText('PAUSED');

  for (let index = 0; index < 3; index += 1) {
    await page.getByTestId('live-step').click();
  }
  const later = await live(page);
  expect(later.operationSeq).toBeGreaterThan(first.operationSeq);

  await page.getByTestId('live-previous').click();
  await expect.poll(async () => (await live(page))?.operationSeq || 0).toBeLessThan(
    later.operationSeq,
  );

  await page.getByTestId('live-reset').click();
  await expect.poll(async () => (await live(page)) ?? null).toBeNull();
  await expect(page.getByTestId('live-state')).toContainText('IDLE');
});

test('continuous run starts, pauses, resumes, changes speed and resets', async ({ page }) => {
  await boot(page);

  await page.getByTestId('live-start').click();
  await expect(page.getByTestId('live-state')).toContainText('RUNNING');
  await expect
    .poll(async () => (await live(page))?.elapsed || 0, { timeout: 12_000 })
    .toBeGreaterThan(1);

  const running = await live(page);
  expect(running.operationSeq).toBeGreaterThan(0);

  await page.getByTestId('live-pause').click();
  await expect(page.getByTestId('live-state')).toContainText('PAUSED');
  const pausedAt = (await live(page)).elapsed;
  await page.waitForTimeout(600);
  const pausedAfter = (await live(page)).elapsed;
  expect(Math.abs(pausedAfter - pausedAt)).toBeLessThan(0.5);

  await page.getByTestId('live-resume').click();
  await expect(page.getByTestId('live-state')).toContainText('RUNNING');

  await page.getByTestId('live-speed-4').click();
  await expect(page.getByTestId('live-speed-4')).toHaveClass(/on/);
  const beforeSpeed = (await live(page)).elapsed;
  await page.waitForTimeout(500);
  const afterSpeed = (await live(page)).elapsed;
  expect(afterSpeed).toBeGreaterThan(beforeSpeed + 1);

  await page.getByTestId('live-stop').click();
  await expect(page.getByTestId('live-state')).toContainText('IDLE');
  // Stopping keeps the recorded results visible until an explicit reset.
  expect((await live(page)).elapsed).toBeGreaterThan(0);

  await page.getByTestId('live-reset').click();
  await expect.poll(async () => (await live(page)) ?? null).toBeNull();
});

test('products animate between graph ports instead of teleporting', async ({ page }) => {
  await boot(page);
  await page.getByTestId('live-start').click();
  await expect
    .poll(async () => (await page.evaluate(() => window.__INDRA__.getProducts()))?.count || 0, {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  const samples = [];
  for (let index = 0; index < 4; index += 1) {
    samples.push(await page.evaluate(() => window.__INDRA__.getProducts()));
    await page.waitForTimeout(250);
  }
  const moved = samples.some((sample, index) => {
    if (index === 0) return false;
    const previous = samples[index - 1];
    return sample.products.some((product) => {
      const before = previous.products.find((item) => item.id === product.id);
      return before && (before.x !== product.x || before.y !== product.y || before.z !== product.z);
    });
  });
  expect(moved, 'at least one product token changes position').toBeTruthy();

  await page.getByTestId('live-stop').click();
});

test('worker avatars follow Assigned Workers and hide at zero', async ({ page }) => {
  await boot(page);
  const factory = await getFactory(page);
  const stations = factory.components.filter(
    (component) => component.type === 'workstation' && Number(component.props.workers) > 0,
  );
  expect(stations.length).toBeGreaterThan(0);

  await page.waitForTimeout(800);
  const debug = await page.evaluate(() => window.__INDRA__.getWorkers());
  expect(debug).not.toBeNull();
  for (const station of stations) {
    const entry = debug.stations.find((item) => item.id === station.id);
    expect(entry?.count, `avatars for ${station.name}`).toBe(Number(station.props.workers));
    expect(entry.statuses.length).toBe(Number(station.props.workers));
  }

  const target = stations[0];
  await page.getByTestId(`object-${target.id}`).click();
  const input = page.getByTestId('prop-workers');
  await expect(input).toBeVisible();
  await input.fill('0');
  await expect
    .poll(async () => {
      const next = await page.evaluate(() => window.__INDRA__.getWorkers());
      return next.stations.find((item) => item.id === target.id)?.count ?? 0;
    })
    .toBe(0);
});

test('live results dashboard reports actual and calculated metrics', async ({ page }) => {
  await boot(page);
  await page.getByTestId('live-step').click();
  await page.getByTestId('live-step').click();
  await page.getByTestId('tab-results').click();

  await expect(page.getByText('Live DES', { exact: false })).toBeVisible();
  await expect(page.getByText('actual', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('calculated', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('assumed', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Worker utilization', { exact: false })).toBeVisible();
  await expect(page.getByTestId('results-reset-live')).toBeVisible();
});
