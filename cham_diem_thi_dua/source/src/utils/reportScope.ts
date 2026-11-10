import type { MonthlyScoreRecord, UserProfile } from '../types';

export function getReportDepartmentId(user: UserProfile): string | null | undefined {
  if (user.role !== 'ttcm') return undefined;
  const id = user.departmentId;
  return id?.trim() && id.trim() !== 'all' ? id : null;
}

export function scopeReportScores(scores: MonthlyScoreRecord[], departmentId: string | null | undefined) {
  if (departmentId === undefined) return scores;
  if (departmentId === null) return [];
  return scores.filter(score => score.departmentId === departmentId);
}
