// Ported from jamaljsr/polar (MIT): src/utils/strings.ts.

const split = (version: string) =>
  [...version.matchAll(/\d+/g)].map(([n]) => Number(n));

/** Compare two versions, like 0.20.0-beta and 0.19.3-beta

  An empty version is equal to all versions

  <A Version String>
  <B Version String>

  @returns
  <1 if A Is Higher, -1 if A Is Lower, 0 if Equal Number>
*/
export default (a: string, b: string): number => {
  if (!a || !b) {
    return 0;
  }

  const [aParts, bParts] = [split(a), split(b)];

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i += 1) {
    const [aNum, bNum] = [aParts[i] || 0, bParts[i] || 0];

    if (aNum !== bNum) {
      return aNum < bNum ? -1 : 1;
    }
  }

  return 0;
};
