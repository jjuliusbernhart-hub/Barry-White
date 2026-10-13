import { CostCategory } from "@prisma/client";

export type PurchaseLine = {
  productId: string | null;
  quantity: number | null;
  amount: number;
};

export type ProductAllocation = {
  productId: string;
  amount: number;
};

export type ProductCostMetric = {
  purchasedQuantity: number;
  purchaseAmount: number;
  allocatedCosts: number;
  averagePurchaseCost: number | null;
  landedCost: number | null;
};

export function suggestCostCategory(value: string) {
  const text = value.toLocaleLowerCase("de");

  if (/(versand|shipping|freight|fracht|delivery|porto)/.test(text)) {
    return CostCategory.SHIPPING;
  }
  if (/(labor|lab\b|analyse|analysis|testing|zertifikat)/.test(text)) {
    return CostCategory.LAB;
  }
  if (/(zoll|customs|duty|einfuhr)/.test(text)) {
    return CostCategory.CUSTOMS;
  }
  if (/(verpack|packaging|karton|etikett|label)/.test(text)) {
    return CostCategory.PACKAGING;
  }

  return CostCategory.OTHER;
}

export function calculateProductCosts(
  productId: string,
  purchaseLines: PurchaseLine[],
  allocations: ProductAllocation[],
): ProductCostMetric {
  const productLines = purchaseLines.filter(
    (line) =>
      line.productId === productId &&
      line.quantity !== null &&
      line.quantity !== 0,
  );
  const purchasedQuantity = productLines.reduce(
    (sum, line) => sum + (line.quantity ?? 0),
    0,
  );
  const purchaseAmount = productLines.reduce(
    (sum, line) => sum + line.amount,
    0,
  );
  const allocatedCosts = allocations
    .filter((allocation) => allocation.productId === productId)
    .reduce((sum, allocation) => sum + allocation.amount, 0);

  return {
    purchasedQuantity,
    purchaseAmount,
    allocatedCosts,
    averagePurchaseCost:
      purchasedQuantity > 0 ? purchaseAmount / purchasedQuantity : null,
    landedCost:
      purchasedQuantity > 0
        ? (purchaseAmount + allocatedCosts) / purchasedQuantity
        : null,
  };
}
