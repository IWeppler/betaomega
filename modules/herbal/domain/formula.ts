export function ingredientPercentages(amounts: string[]): (number | null)[] {
  const parts = amounts.map(amount => {
    const match = /^(\d+(?:[.,]\d+)?)\s+partes?$/i.exec(amount.trim());
    return match ? Number(match[1].replace(",", ".")) : NaN;
  });
  const total = parts.reduce((sum, part) => sum + part, 0);
  if (!parts.length || parts.some(part => !Number.isFinite(part) || part <= 0) || !Number.isFinite(total)) return amounts.map(() => null);
  return parts.map(part => part / total * 100);
}
