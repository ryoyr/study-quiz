/**
 * グラフの横軸ラベル位置を、両端を含めて均等に間引く。
 * 末尾を無条件追加する方式にすると、末尾直前のラベルと重なるため、
 * 全区間を tickCount - 1 等分して位置を決める。
 */
export const selectChartTickIndexes = (
  length: number,
  maximumTicks = 5,
): number[] => {
  if (!Number.isInteger(length) || length <= 0) return [];
  if (length === 1 || maximumTicks <= 1) return [0];

  const tickCount = Math.min(length, Math.max(2, Math.floor(maximumTicks)));
  return [
    ...new Set(
      Array.from({ length: tickCount }, (_, index) =>
        Math.round((index * (length - 1)) / (tickCount - 1)),
      ),
    ),
  ];
};