import { expect, test as base } from "@playwright/test";

/**
 * Every browser check also fails on a console error or an uncaught exception, so hydration
 * mismatches and runtime errors are caught in whatever a test was doing, not by one smoke test.
 */
export const test = base.extend<{ noConsoleErrors: void }>({
  noConsoleErrors: [
    async ({ page }, run) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await run();
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
