function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function deriveSalePrice(purchasePrice?: number): number | undefined {
  if (typeof purchasePrice !== 'number' || !Number.isFinite(purchasePrice)) return undefined;
  return roundCurrency(purchasePrice * 1.3);
}

export function deriveWarehouseValue(purchasePrice?: number, qty?: number): number | undefined {
  if (typeof purchasePrice !== 'number' || !Number.isFinite(purchasePrice)) return undefined;
  const safeQty =
    typeof qty === 'number' && Number.isFinite(qty) ? Math.max(0, Math.round(qty)) : 0;
  return roundCurrency(purchasePrice * safeQty);
}

export function deriveMarginValue(purchasePrice?: number, salePrice?: number): number | undefined {
  if (typeof purchasePrice !== 'number' || !Number.isFinite(purchasePrice)) return undefined;
  if (typeof salePrice !== 'number' || !Number.isFinite(salePrice)) return undefined;
  return roundCurrency(salePrice - purchasePrice);
}
