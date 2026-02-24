import { CompRequest } from '../../types';

const GRADE_REGEX = /\b(PSA|BGS|SGC|CGC|HGA|BVG|GMA|MNT|CSG|AGS)\s*(\d+(?:\.\d+)?|Auth(?:entic)?)\b/i;

export function extractGradeFromTitle(title: string): { company: string; grade: string } | null {
  const match = title.match(GRADE_REGEX);
  if (!match) return null;
  const company = match[1].toUpperCase();
  let grade = match[2];
  if (/^auth/i.test(grade)) grade = 'Auth';
  return { company, grade };
}

export function filterByGrade<T extends { title: string }>(
  sales: T[],
  request: CompRequest
): T[] {
  if (!request.isGraded || !request.gradingCompany || !request.grade) return sales;

  const targetCompany = request.gradingCompany.toUpperCase();
  const targetGrade = request.grade;

  const matched = sales.filter(s => {
    const info = extractGradeFromTitle(s.title);
    if (!info) return false;
    return info.company === targetCompany && info.grade === targetGrade;
  });

  return matched.length >= 3 ? matched : sales;
}
