import { test, expect } from '@playwright/test';
import {
  boot,
  canvasBox,
  componentOfType,
  connectPorts,
  dragObject,
  getCamera,
  getFactory,
  getResult,
  getSelection,
  getView,
  placeByTool,
  runSimulation,
  selectObject,
} from './helpers.js';

const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) || [], 'uncaught browser errors').toEqual([]);
});

test('app loads the WASM simulation core without browser errors', async ({ page }) => {
  await boot(page);
  const result = await getResult(page);
  expect(result.engine).toBe('wasm');
  expect(result.ok).toBe(true);
  expect(result.connectionCount).toBe(8);
  await expect(page.locator('footer')).toContainText('C++/WASM DES');
  await expect(page.getByTestId('factory-canvas')).toBeVisible();
});

test('wheel zoom changes the camera distance', async ({ page }) => {
  await boot(page);
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  const before = await getCamera(page);
  await page.mouse.wheel(0, -700);
  await page.waitForTimeout(900);
  const zoomedIn = await getCamera(page);
  expect(zoomedIn.distance).toBeLessThan(before.distance * 0.98);

  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(900);
  const zoomedOut = await getCamera(page);
  expect(zoomedOut.distance).toBeGreaterThan(zoomedIn.distance);
});

test('left-drag orbits and right-drag pans the camera', async ({ page }) => {
  await boot(page);
  const box = await canvasBox(page);
  const empty = { x: box.x + box.width * 0.84, y: box.y + box.height * 0.8 };

  const beforeOrbit = await getCamera(page);
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down();
  await page.mouse.move(empty.x - 130, empty.y - 35, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  const afterOrbit = await getCamera(page);
  const orbitDelta =
    Math.abs(afterOrbit.position.x - beforeOrbit.position.x) +
    Math.abs(afterOrbit.position.y - beforeOrbit.position.y) +
    Math.abs(afterOrbit.position.z - beforeOrbit.position.z);
  expect(orbitDelta).toBeGreaterThan(0.5);

  const beforePan = afterOrbit;
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(empty.x + 120, empty.y + 55, { steps: 16 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(900);
  const afterPan = await getCamera(page);
  const panDelta =
    Math.abs(afterPan.target.x - beforePan.target.x) +
    Math.abs(afterPan.target.z - beforePan.target.z);
  expect(panDelta).toBeGreaterThan(0.5);
});

test('top and 3D view buttons switch the active camera', async ({ page }) => {
  await boot(page);
  expect(await getView(page)).toBe('3d');

  await page.getByTestId('view-top').click();
  await expect.poll(() => getView(page)).toBe('top');
  await expect(page.getByTestId('view-top')).toHaveClass(/active/);
  const top = await getCamera(page);
  expect(top.position.y).toBeGreaterThan(30);

  await page.getByTestId('view-3d').click();
  await expect.poll(() => getView(page)).toBe('3d');
  await expect(page.getByTestId('view-3d')).toHaveClass(/active/);
  const perspective = await getCamera(page);
  expect(perspective.view).toBe('3d');
  expect(perspective.distance).toBeGreaterThan(1);
});

test('dragging a workstation from the component library places it on the grid', async ({ page }) => {
  await boot(page);
  const before = await getFactory(page);
  const box = await canvasBox(page);

  await page.getByTestId('tool-workstation').dragTo(page.getByTestId('factory-canvas'), {
    targetPosition: { x: box.width * 0.72, y: box.height * 0.68 },
  });

  await expect.poll(async () => (await getFactory(page)).components.length).toBe(
    before.components.length + 1,
  );
  const after = await getFactory(page);
  const placed = after.components[after.components.length - 1];
  expect(placed.type).toBe('workstation');
  expect(placed.name).toContain('Workstation');
  expect(Number.isInteger(placed.position.x)).toBe(true);
  expect(Number.isInteger(placed.position.z)).toBe(true);
});

test('dragging a workstation body moves it and W selects move mode', async ({ page }) => {
  await boot(page);
  await selectObject(page, 'N5');
  const before = (await getFactory(page)).components.find((component) => component.id === 'N5');

  await dragObject(page, 'N5', 90, 65);
  await expect
    .poll(async () => {
      const component = (await getFactory(page)).components.find((item) => item.id === 'N5');
      return (
        Math.abs(component.position.x - before.position.x) +
        Math.abs(component.position.z - before.position.z)
      );
    })
    .toBeGreaterThan(0.4);

  await page.keyboard.press('e');
  await expect(page.getByTestId('mode-rotate')).toHaveClass(/active/);
  await page.keyboard.press('w');
  await expect(page.getByTestId('mode-move')).toHaveClass(/active/);
});

test('rotate mode and the rotation control update the 3D transform', async ({ page }) => {
  await boot(page);
  await selectObject(page, 'N3');
  const before = await page.evaluate(() => window.__ITS__.portPoint('N3', 'material-out'));

  await page.getByTestId('mode-rotate').click();
  await expect(page.getByTestId('mode-rotate')).toHaveClass(/active/);

  const rotation = page.getByTestId('transform-rotation-y');
  await rotation.fill('90');
  await rotation.blur();

  await expect
    .poll(async () => (await getFactory(page)).components.find((c) => c.id === 'N3').rotation.y)
    .toBeCloseTo(Math.PI / 2, 3);
  const after = await page.evaluate(() => window.__ITS__.portPoint('N3', 'material-out'));
  const shift = Math.hypot(after.x - before.x, after.y - before.y);
  expect(shift).toBeGreaterThan(5);
});

test('duplicate, delete and undo controls update the factory', async ({ page }) => {
  await boot(page);
  const initial = (await getFactory(page)).components.length;
  await selectObject(page, 'N4');

  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect.poll(async () => (await getFactory(page)).components.length).toBe(initial + 1);
  const selection = await getSelection(page);
  expect(selection.length).toBe(1);
  expect(selection[0]).not.toBe('N4');

  await page.keyboard.press('Delete');
  await expect.poll(async () => (await getFactory(page)).components.length).toBe(initial);

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getFactory(page)).components.length).toBe(initial + 1);
});

test('editing workstation properties updates the model and marks results stale', async ({ page }) => {
  await boot(page);
  await selectObject(page, 'N3');

  await page.getByTestId('component-name').fill('Assembly Alpha');
  await page.getByTestId('prop-cycleTime').fill('35');
  await page.getByTestId('prop-cycleTime').blur();
  await page.getByTestId('prop-workers').fill('3');
  await page.getByTestId('prop-workers').blur();

  await expect
    .poll(async () => {
      const component = (await getFactory(page)).components.find((item) => item.id === 'N3');
      return [component.name, component.props.cycleTime, component.props.workers];
    })
    .toEqual(['Assembly Alpha', 35, 3]);
  await expect(page.getByTestId('object-N3')).toContainText('Assembly Alpha');

  await page.getByTestId('tab-results').click();
  await expect(page.getByText('STALE', { exact: true })).toBeVisible();
});

test('properties panel groups industrial sections with units and reset controls', async ({ page }) => {
  await boot(page);
  await selectObject(page, 'N3');

  for (const title of [
    'Operational Parameters',
    'Production Parameters',
    'Resource Parameters',
    'Energy Parameters',
    'Reliability and Maintenance',
    'Live Metrics',
  ]) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }

  const cycle = page.getByTestId('prop-cycleTime');
  await expect(cycle).toHaveValue('20');
  await expect(cycle.locator('xpath=..').locator('.unit-pill')).toHaveText('s/pc');
  await expect(
    page.getByTestId('prop-powerKw').locator('xpath=..').locator('.unit-pill'),
  ).toHaveText('kW');

  const cycleField = cycle.locator('xpath=../..');
  await cycle.fill('35');
  await cycle.blur();
  await expect(cycleField).toHaveClass(/modified/);
  await cycleField
    .getByRole('button', { name: 'Reset Cycle time per piece to default' })
    .click();
  await expect(cycle).toHaveValue('20');

  await expect(page.getByText('Calculated', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Tool condition').first()).toBeVisible();
  await expect(page.getByText('Future enhancement').first()).toBeVisible();
});

test('connects Source to Conveyor to Workstation to Output by dragging ports', async ({ page }) => {
  await boot(page);

  await page.getByTestId('open-file-dialog').click();
  await page.getByRole('button', { name: 'New factory' }).click();
  await expect.poll(async () => (await getFactory(page)).components.length).toBe(0);

  await page.getByTestId('view-top').click();
  await expect.poll(() => getView(page)).toBe('top');

  const source = await placeByTool(page, 'source', 0.24, 0.58);
  const conveyor = await placeByTool(page, 'conveyor', 0.43, 0.58);
  const workstation = await placeByTool(page, 'workstation', 0.62, 0.58);
  const output = await placeByTool(page, 'output', 0.8, 0.58);

  await selectObject(page, workstation.id);
  await page.getByRole('button', { name: 'Required / enabled' }).click();
  await expect
    .poll(async () =>
      (await getFactory(page)).components.find((component) => component.id === workstation.id).props
        .humanRequired,
    )
    .toBe(false);

  await page.keyboard.press('Escape');
  await page.getByTestId('mode-connect').click();

  await connectPorts(page, source.id, 'material-out', conveyor.id, 'material-in');
  await expect.poll(async () => (await getFactory(page)).connections.length).toBe(1);
  await connectPorts(page, conveyor.id, 'material-out', workstation.id, 'material-in');
  await expect.poll(async () => (await getFactory(page)).connections.length).toBe(2);
  await connectPorts(page, workstation.id, 'material-out', output.id, 'material-in');
  await expect.poll(async () => (await getFactory(page)).connections.length).toBe(3);

  const factory = await getFactory(page);
  const has = (from, to) =>
    factory.connections.some(
      (connection) => connection.from === from && connection.to === to,
    );
  expect(has(source.id, conveyor.id)).toBe(true);
  expect(has(conveyor.id, workstation.id)).toBe(true);
  expect(has(workstation.id, output.id)).toBe(true);

  await runSimulation(page);
  await expect
    .poll(async () => {
      const result = await getResult(page);
      return { ok: result?.ok, links: result?.connectionCount, good: result?.good };
    })
    .toEqual({ ok: true, links: 3, good: expect.any(Number) });
  const result = await getResult(page);
  expect(result.good).toBeGreaterThan(0);
  expect(result.engine).toBe('wasm');
});

test('saving a layout and reloading the saved version restores it', async ({ page }) => {
  await boot(page);
  await selectObject(page, 'N5');
  await page.getByTestId('component-name').fill('Inspection Alpha');
  await page.getByTestId('transform-position-x').fill('2.5');
  await page.getByTestId('transform-position-x').blur();

  await expect
    .poll(async () => {
      const component = (await getFactory(page)).components.find((item) => item.id === 'N5');
      return [component.name, component.position.x];
    })
    .toEqual(['Inspection Alpha', 2.5]);

  await page.getByTestId('save-factory').click();
  await page.getByTestId('save-name').fill('E2E Saved Layout');
  await page.getByTestId('save-version').click();
  await expect(page.locator('.modal')).toContainText('E2E Saved Layout');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__ITS__), null, { timeout: 20_000 });

  await page.getByTestId('open-file-dialog').click();
  await page.getByRole('button', { name: 'New factory' }).click();
  await expect.poll(async () => (await getFactory(page)).components.length).toBe(0);

  await page.getByTestId('open-file-dialog').click();
  const row = page.locator('.version-row').filter({ hasText: 'E2E Saved Layout' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Load' }).click();

  await expect.poll(async () => (await getFactory(page)).components.length).toBe(8);
  const restored = (await getFactory(page)).components.find((item) => item.id === 'N5');
  expect(restored.name).toBe('Inspection Alpha');
  expect(restored.position.x).toBe(2.5);
});

test('simulating a loaded saved graph uses its connections and WASM engine', async ({ page }) => {
  await boot(page);

  await page.getByTestId('save-factory').click();
  await page.getByTestId('save-name').fill('E2E Simulation Graph');
  await page.getByTestId('save-version').click();
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await page.getByTestId('disconnect-C1').click();
  await expect.poll(async () => (await getFactory(page)).connections.length).toBe(7);
  await runSimulation(page);
  await expect.poll(async () => (await getResult(page)).connectionCount).toBe(7);
  await expect.poll(async () => (await getResult(page)).good).toBe(0);

  await page.getByTestId('open-file-dialog').click();
  const row = page.locator('.version-row').filter({ hasText: 'E2E Simulation Graph' });
  await row.getByRole('button', { name: 'Load' }).click();
  await expect.poll(async () => (await getFactory(page)).connections.length).toBe(8);

  await runSimulation(page);
  await expect
    .poll(async () => {
      const result = await getResult(page);
      return { ok: result?.ok, links: result?.connectionCount, good: result?.good > 0, engine: result?.engine };
    })
    .toEqual({ ok: true, links: 8, good: true, engine: 'wasm' });
  await expect(page.getByText('C++/WASM core')).toBeVisible();
});

test('compares a proposal with the baseline and gates approval by role', async ({ page }) => {
  await boot(page);
  await selectObject(page, 'N3');
  await page.getByTestId('prop-cycleTime').fill('45');
  await page.getByTestId('prop-cycleTime').blur();
  await expect
    .poll(async () => (await getFactory(page)).components.find((c) => c.id === 'N3').props.cycleTime)
    .toBe(45);

  await page.getByTestId('tab-change').click();
  await page.getByTestId('compare-change').click();
  await expect(page.getByText('Production comparison')).toBeVisible();
  await expect(page.getByText('Changed machine properties')).toBeVisible();
  await expect(page.locator('.diff-item').filter({ hasText: 'Cycle time per piece' })).toContainText(
    '20 → 45',
  );

  const approve = page.getByTestId('approve-change');
  await expect(approve).toBeDisabled();

  await page.getByTestId('approval-role').selectOption('Plant Manager');
  await expect(approve).toBeDisabled();

  await page.getByTestId('implementation-confirmed').check();
  await expect(approve).toBeEnabled();
  await approve.click();

  await expect(page.locator('footer')).toContainText('Baseline approved');
  await expect(page.locator('.audit-row').filter({ hasText: 'Plant Manager' })).toBeVisible();
  await expect(page.getByText('Approved baseline:')).toContainText('Plant Demo / Line 01');

  const stored = await page.evaluate(() => ({
    baseline: JSON.parse(localStorage.getItem('its:v2:baseline')),
    audit: JSON.parse(localStorage.getItem('its:v2:audit')),
  }));
  expect(stored.baseline.approvedRole).toBe('Plant Manager');
  expect(stored.baseline.factory.components.find((c) => c.id === 'N3').props.cycleTime).toBe(45);
  expect(stored.audit[0].role).toBe('Plant Manager');
});
