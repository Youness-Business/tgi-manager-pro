const units = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

function underHundred(value: number): string {
  if (value <= 16) return units[value];
  if (value < 20) return `dix-${units[value - 10]}`;
  if (value < 70) {
    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    const tensWords = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];
    if (remainder === 0) return tensWords[tens];
    if (remainder === 1) return `${tensWords[tens]} et un`;
    return `${tensWords[tens]}-${units[remainder]}`;
  }
  if (value < 80) {
    return value === 71
      ? "soixante et onze"
      : `soixante-${underHundred(value - 60)}`;
  }
  if (value < 100) {
    return value === 80
      ? "quatre-vingts"
      : `quatre-vingt-${underHundred(value - 80)}`;
  }
  return "cent";
}

function underThousand(value: number): string {
  if (value < 100) return underHundred(value);

  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const prefix = hundreds === 1 ? "cent" : `${units[hundreds]} cent`;
  if (remainder === 0) return hundreds > 1 ? `${prefix}s` : prefix;
  return `${prefix} ${underHundred(remainder)}`;
}

function integerToFrenchWords(value: number): string {
  if (value < 1000) return underThousand(value);

  const scales = ["", "mille", "million", "milliard", "billion", "billiard"];
  const scaleIndex = Math.floor(Math.log(value) / Math.log(1000));
  const scaleValue = 1000 ** scaleIndex;
  const group = Math.floor(value / scaleValue);
  const remainder = value - group * scaleValue;
  const scale = scales[scaleIndex] ?? "billion";
  const groupWords = underThousand(group);
  const scaleWords =
    scaleIndex === 1
      ? group === 1
        ? "mille"
        : `${groupWords} mille`
      : `${groupWords} ${scale}${group > 1 ? "s" : ""}`;

  if (remainder === 0) return scaleWords;
  return `${scaleWords} ${integerToFrenchWords(remainder)}`;
}

export function amountToFrenchWords(total: number): string {
  const amount = Number.isFinite(total) ? Math.max(0, total) : 0;
  const centsTotal = Math.round((amount + Number.EPSILON) * 100);
  const dirhams = Math.floor(centsTotal / 100);
  const centimes = centsTotal % 100;

  return `Arrêtée la présente facture à la somme de : ${integerToFrenchWords(dirhams)} dirhams et ${integerToFrenchWords(centimes)} centimes`;
}
