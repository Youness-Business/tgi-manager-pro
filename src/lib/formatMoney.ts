const currencyFormatter = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
});

export function formatMoney(amount: number): string {
  return currencyFormatter.format(amount);
}
