/** Coarse, anonymous shades only; never change the stored face probabilities. */
export function distributionHint(probabilities: readonly number[]) {
  const opacities = [...probabilities].sort((a, b) => b - a)
    .map(probability => probability < .1 ? .16 : probability < .25 ? .49 : 1);
  const count = (opacity: number) => opacities.filter(value => value === opacity).length;
  return {
    opacities,
    description: `Anonymous probability distribution, highest to lowest likelihood: ${count(1)} high, ${count(.49)} moderate, ${count(.16)} low.`,
  };
}
