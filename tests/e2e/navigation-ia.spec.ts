import { expect, test } from "@playwright/test";

test("domain navigation preserves direct defaults, sibling access, and Dashboard views", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Table" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Timeline" })).toBeVisible();

  const inventory = page.getByRole("link", { name: "Inventory", exact: true });
  await expect(inventory).toHaveAttribute("href", "/inventory");
  await inventory.hover();
  await expect(
    page.getByRole("link", { name: /Current Inventory/ }),
  ).toHaveAttribute("href", "/inventory");
  await expect(
    page.getByRole("link", { name: /Pending Receivals/ }),
  ).toHaveAttribute(
    "href",
    "/inventory?section=pending-receivals#pending-receivals",
  );
  await expect(page.getByRole("link", { name: /^Activity/ })).toHaveAttribute(
    "href",
    "/activity",
  );

  await inventory.click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(inventory).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("link", { name: /Current Inventory/ }),
  ).not.toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await inventory.hover();
  await page.getByRole("link", { name: /Pending Receivals/ }).click();
  await expect(page).toHaveURL(/\/inventory\?section=pending-receivals#pending-receivals$/);
  await expect(
    page.getByRole("button", { name: /Pending Receivals/ }),
  ).toHaveAttribute("aria-expanded", "true");

  const purchasing = page.getByRole("link", {
    name: "Purchasing",
    exact: true,
  });
  await expect(purchasing).toHaveAttribute("href", "/purchasing");
  await purchasing.hover();
  await expect(
    page.getByRole("link", { name: /Purchase Orders/ }),
  ).toHaveAttribute("href", "/purchasing");
  await expect(page.getByRole("link", { name: /^Catalog/ })).toHaveAttribute(
    "href",
    "/catalog",
  );

  const reporting = page.getByRole("link", {
    name: "Reporting",
    exact: true,
  });
  await expect(reporting).toHaveAttribute("href", "/manpower-reporting");
  await reporting.hover();
  await expect(page.getByRole("link", { name: /^Manpower/ })).toHaveAttribute(
    "href",
    "/manpower-reporting",
  );
  await expect(
    page.getByRole("link", { name: /^Material Usage/ }),
  ).toHaveAttribute("href", "/material-usage");
  await expect(
    page.locator('[aria-disabled="true"]').filter({ hasText: "Daily Production" }),
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toHaveAttribute("href", "/settings");
});

test("display size applies immediately and persists across navigation and reload", async ({
  page,
}) => {
  await page.goto("/settings");

  await page.getByRole("radio", { name: /Large/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-display-size", "large");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
    .toBe("18px");
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem("tenops_display_size")),
    )
    .toBe("large");

  await page.goto("/inventory");
  await expect(page.locator("html")).toHaveAttribute("data-display-size", "large");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-display-size", "large");

  await page.goto("/settings");
  await page.getByRole("radio", { name: /Compact/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-display-size", "compact");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
    .toBe("14px");
});

test("interface language applies immediately and persists without translating data", async ({
  page,
}) => {
  await page.goto("/settings");

  await page.getByRole("radio", { name: "Español" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("heading", { name: "Configuración", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Compras", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem("tenops_language")),
    )
    .toBe("es");

  await page.goto("/inventory");
  await expect(
    page.getByRole("link", { name: "Inventario", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("link", { name: "Reportes", exact: true }),
  ).toBeVisible();

  await page.goto("/material-usage");
  await expect(
    page.getByRole("heading", { name: "Uso de materiales", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Fabricante" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Cantidad" })).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("radio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
});
