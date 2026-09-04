import { expect, test } from "@playwright/test";

test("renders and replays the public walking trace without overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Mappie", { exact: true })).toBeVisible();
  await expect(page.getByText(/OSM TRACE 11982156/)).toBeVisible();
  await expect(page.locator("svg path").first()).toBeVisible({
    timeout: 10_000,
  });

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
