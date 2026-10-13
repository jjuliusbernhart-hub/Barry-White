import { CostCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateProductCosts, suggestCostCategory } from "./costs";

describe("calculateProductCosts", () => {
  it("berechnet gewichteten Einkauf und Landed Costs", () => {
    const result = calculateProductCosts(
      "product-a",
      [
        { productId: "product-a", quantity: 10, amount: 1000 },
        { productId: "product-a", quantity: 5, amount: 600 },
      ],
      [{ productId: "product-a", amount: 150 }],
    );

    expect(result.purchasedQuantity).toBe(15);
    expect(result.averagePurchaseCost).toBeCloseTo(106.6667, 4);
    expect(result.landedCost).toBeCloseTo(116.6667, 4);
  });

  it("berücksichtigt Lieferantengutschriften als negative Werte", () => {
    const result = calculateProductCosts(
      "product-a",
      [
        { productId: "product-a", quantity: 10, amount: 1000 },
        { productId: "product-a", quantity: -2, amount: -200 },
      ],
      [],
    );

    expect(result.purchasedQuantity).toBe(8);
    expect(result.purchaseAmount).toBe(800);
    expect(result.averagePurchaseCost).toBe(100);
  });
});

describe("suggestCostCategory", () => {
  it.each([
    ["DHL international shipping", CostCategory.SHIPPING],
    ["Laboranalyse Cannabinoidprofil", CostCategory.LAB],
    ["Einfuhrabgaben Zoll", CostCategory.CUSTOMS],
    ["Verpackung und Etiketten", CostCategory.PACKAGING],
    ["Beratung", CostCategory.OTHER],
  ])("klassifiziert %s", (description, expected) => {
    expect(suggestCostCategory(description)).toBe(expected);
  });
});
