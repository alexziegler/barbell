export type PRMetric = 'weight' | '1rm' | 'volume';

export type MetricStat = { value: number; dateISO: string };

export type ExercisePRSummary = {
  exerciseId: string;
  exerciseName: string;
  weightPR: MetricStat | null;
  oneRMPR: MetricStat | null;
  volumePR: MetricStat | null;
};

export function detectImprovedMetrics(
  prev: ExercisePRSummary | null | undefined,
  next: ExercisePRSummary | null | undefined,
): PRMetric[] {
  if (!next) return [];

  const metrics: PRMetric[] = [];

  const nextWeight = Number(next.weightPR?.value ?? NaN);
  const prevWeight = Number(prev?.weightPR?.value ?? NaN);
  if (Number.isFinite(nextWeight) && (!Number.isFinite(prevWeight) || nextWeight > prevWeight)) {
    metrics.push('weight');
  }

  const nextOneRM = Number(next.oneRMPR?.value ?? NaN);
  const prevOneRM = Number(prev?.oneRMPR?.value ?? NaN);
  if (Number.isFinite(nextOneRM) && (!Number.isFinite(prevOneRM) || nextOneRM > prevOneRM)) {
    metrics.push('1rm');
  }

  const nextVolume = Number(next.volumePR?.value ?? NaN);
  const prevVolume = Number(prev?.volumePR?.value ?? NaN);
  if (Number.isFinite(nextVolume) && (!Number.isFinite(prevVolume) || nextVolume > prevVolume)) {
    metrics.push('volume');
  }

  return metrics;
}

export const THOUSAND_LB_TARGET_KG = 1000 * 0.45359237;

export type ClubProgress = {
  benchKg: number | null;
  deadliftKg: number | null;
  squatKg: number | null;
  totalKg: number;
  percent: number;
  reachedTarget: boolean;
};

export function computeThousandLbProgress(prs: ExercisePRSummary[]): ClubProgress {
  if (!prs?.length) {
    return {
      benchKg: null,
      deadliftKg: null,
      squatKg: null,
      totalKg: 0,
      percent: 0,
      reachedTarget: false,
    };
  }

  const lowerName = (name: string) => name.toLowerCase();

  const pickPR = (
    match: (name: string) => boolean,
    exclude?: (name: string) => boolean,
  ): MetricStat | null => {
    const candidates = prs
      .filter((pr) => pr.oneRMPR && Number.isFinite(pr.oneRMPR.value))
      .filter((pr) => {
        const name = lowerName(pr.exerciseName);
        return match(name) && (!exclude || !exclude(name));
      });

    if (!candidates.length) return null;

    return candidates.reduce<MetricStat | null>((best, current) => {
      const currentMetric = current.oneRMPR!;
      if (!best || currentMetric.value > best.value) {
        return { value: currentMetric.value, dateISO: currentMetric.dateISO };
      }
      return best;
    }, null);
  };

  const bench = pickPR((name) => name.includes('bench'));
  const deadlift = pickPR((name) => name.includes('deadlift') || name.includes('dead lift'));
  const squatPreferred = pickPR((name) => name.includes('squat') && name.includes('back'));
  const squatFallback = squatPreferred ?? pickPR(
    (name) => name.includes('squat'),
    (name) => name.includes('front') || name.includes('overhead') || name.includes('zercher'),
  );

  const benchKg = bench?.value ?? null;
  const deadliftKg = deadlift?.value ?? null;
  const squatKg = squatFallback?.value ?? null;

  const partials = [benchKg, deadliftKg, squatKg].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  const totalKg = partials.reduce((acc, value) => acc + value, 0);
  const percent = partials.length
    ? Math.max(0, Math.min(100, (totalKg / THOUSAND_LB_TARGET_KG) * 100))
    : 0;

  return {
    benchKg,
    deadliftKg,
    squatKg,
    totalKg,
    percent,
    reachedTarget: totalKg >= THOUSAND_LB_TARGET_KG,
  };
}
