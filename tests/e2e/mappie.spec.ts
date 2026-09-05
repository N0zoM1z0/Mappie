import { expect, test } from "@playwright/test";

test("explores public traces and records optional discoveries", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Mappie", { exact: true })).toBeVisible();
  await expect(page.getByText(/OSM TRACE 11982156/)).toBeVisible();
  await expect(page.locator("svg path").first()).toBeVisible({
    timeout: 10_000,
  });
  const discovery = page.getByRole("button", { name: /Open discovery:/ });
  await expect(discovery).toBeVisible({ timeout: 10_000 });
  await discovery.click();
  await expect(page.getByText("1/3", { exact: true })).toBeVisible();
  await expect(page.getByText(/MEMORY ADDED/)).toBeVisible();

  await page.getByRole("button", { name: "Play public trace replay" }).click();
  const person = page.getByRole("button", {
    name: "Open discovery: Passing mapper",
  });
  await expect(person).toBeVisible({ timeout: 10_000 });
  await person.click();
  await expect(page.getByText("2/3", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Next public trace" }).click();
  await expect(page.getByText(/OSM TRACE 12425703/)).toBeVisible();
  await expect(page.getByText(/ARCTIC WALKING LOOP/)).toBeVisible();

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("tab", { name: "MY MAP" }).click();
  await expect(
    page.getByRole("button", { name: "Import a GPX route" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start live exploration" }),
  ).toBeVisible();
  await expect(page.getByText("UNWRITTEN TERRITORY")).toBeVisible();
});
