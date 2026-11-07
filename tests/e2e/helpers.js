import { expect } from '@playwright/test';

export async function boot(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => Boolean(window.__ITS__) && Boolean(document.querySelector('canvas.factory-canvas')),
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => {
      const result = window.__ITS__.getResult();
      return Boolean(result && result.ok);
    },
    null,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(250);
}

export function getFactory(page) {
  return page.evaluate(() => window.__ITS__.getFactory());
}

export function getResult(page) {
  return page.evaluate(() => window.__ITS__.getResult());
}

export function getView(page) {
  return page.evaluate(() => window.__ITS__.getView());
}

export function getSelection(page) {
  return page.evaluate(() => window.__ITS__.getSelection());
}

export function getCamera(page) {
  return page.evaluate(() => window.__ITS__.camera());
}

export async function canvasBox(page) {
  const box = await page.getByTestId('factory-canvas').boundingBox();
  expect(box, 'factory canvas must be visible').not.toBeNull();
  return box;
}

export async function objectPoint(page, id) {
  const point = await page.evaluate((componentId) => window.__ITS__.screenPoint(componentId), id);
  expect(point, `screen point for ${id}`).not.toBeNull();
  expect(point.visible, `screen point for ${id} must be on screen`).toBeTruthy();
  return point;
}

export async function portPoint(page, id, kind) {
  const point = await page.evaluate(
    ({ componentId, portKind }) => window.__ITS__.portPoint(componentId, portKind),
    { componentId: id, portKind: kind },
  );
  expect(point, `port ${id}/${kind}`).not.toBeNull();
  expect(point.visible, `port ${id}/${kind} must be on screen`).toBeTruthy();
  return point;
}

export async function dragMouse(page, from, to, button = 'left') {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  const steps = 14;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
  }
  await page.mouse.up({ button });
}

export async function dragObject(page, id, dx, dy, grabOffset = { x: 12, y: 0 }) {
  const from = await objectPoint(page, id);
  // Grab the object body slightly off-centre so the transform gizmo does not
  // intercept the press (its Y axis runs through the object's centre).
  await dragMouse(page, { x: from.x + grabOffset.x, y: from.y + grabOffset.y }, { x: from.x + grabOffset.x + dx, y: from.y + grabOffset.y + dy });
}

export async function connectPorts(page, fromId, fromKind, toId, toKind) {
  const from = await portPoint(page, fromId, fromKind);
  const to = await portPoint(page, toId, toKind);
  await dragMouse(page, from, to);
}

export async function selectObject(page, id) {
  await page.getByTestId(`object-${id}`).click();
  await expect.poll(() => getSelection(page)).toContain(id);
}

export function componentOfType(factory, type) {
  return factory.components.find((component) => component.type === type);
}

export async function newFactory(page) {
  await page.getByTestId('open-file-dialog').click();
  await page.getByRole('button', { name: 'New factory' }).click();
  await expect.poll(async () => (await getFactory(page)).components.length).toBe(0);
}

export async function placeByTool(page, type, ratioX, ratioY) {
  const before = (await getFactory(page)).components.length;
  await page.getByTestId(`tool-${type}`).click();
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width * ratioX, box.y + box.height * ratioY);
  await expect.poll(async () => (await getFactory(page)).components.length).toBe(before + 1);
  const factory = await getFactory(page);
  const placed = factory.components[factory.components.length - 1];
  expect(placed.type).toBe(type);
  return placed;
}

export async function runSimulation(page) {
  await page.getByTestId('run-simulation').click();
  await expect(page.getByTestId('tab-results')).toHaveClass(/on/);
}
