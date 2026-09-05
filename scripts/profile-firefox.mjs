import { firefox } from "@playwright/test";

const baseUrl = process.env.MAPPIE_URL ?? "http://127.0.0.1:8081";

function sampleAnimation(page, durationMs) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const gaps = [];
        let previous = performance.now();
        const start = previous;
        const frame = (now) => {
          gaps.push(now - previous);
          previous = now;
          if (now - start >= duration) {
            resolve({
              deliveredFrames: gaps.length,
              frameGapsAbove50Ms: gaps.filter((gap) => gap > 50).length,
              maximumFrameGapMs: Math.max(...gaps),
            });
            return;
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    durationMs,
  );
}

function svgCounts(page) {
  return page.evaluate(() => ({
    descendants: document.querySelectorAll("svg *").length,
    groups: document.querySelectorAll("svg g").length,
    paths: document.querySelectorAll("svg path").length,
  }));
}

const browser = await firefox.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { height: 800, width: 1280 },
  });
  await page.goto(baseUrl);
  await page.locator("svg path").first().waitFor();

  const forward = page.getByRole("button", {
    name: "Forward ten exploration sessions",
  });
  for (let index = 0; index < 3; index += 1) await forward.click();
  await page.getByText(/SESSION 31 \/ 70/).waitFor();
  const animation = await sampleAnimation(page, 3_500);
  const session31 = await svgCounts(page);

  for (let index = 0; index < 4; index += 1) await forward.click();
  await page.getByText(/SESSION 70 \/ .* REVISITED/).waitFor({
    timeout: 7_000,
  });
  const session70 = await svgCounts(page);

  console.log(
    JSON.stringify({ animation, baseUrl, session31, session70 }, null, 2),
  );
} finally {
  await browser.close();
}
