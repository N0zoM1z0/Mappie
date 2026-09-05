import { expect, test } from "@playwright/test";

test("builds one unknown map from repeated public sessions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Mappie", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "RECONSTRUCTION" })).toBeVisible();
  await expect(page.getByText(/OSM 10081548/)).toBeVisible();
  await expect(page.locator("svg path").first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator("svg g").first()).toHaveAttribute(
    "transform",
    /scale\(1\.35\)/,
  );
  await page.waitForTimeout(500);
  await expect(page.locator("svg g").first()).toHaveAttribute(
    "transform",
    /scale\(1\.35\)/,
  );
  await expect(page.getByText("SESSIONS", { exact: true })).toBeVisible();
  await expect(page.getByText("CONF.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Next exploration session" }).click();
  await expect(page.getByText(/SESSION 02 \/ 70/)).toBeVisible();
  await expect(page.getByText(/OSM 10082156/)).toBeVisible();

  await page.getByRole("tab", { name: "RAW layer" }).click();
  await expect(
    page.getByRole("tab", { name: "RAW layer selected" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "MAP layer" }).click();
  await page
    .getByRole("button", { name: "Forward ten exploration sessions" })
    .click();
  await expect(page.getByText(/SESSION 12 \/ 70/)).toBeVisible();

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
