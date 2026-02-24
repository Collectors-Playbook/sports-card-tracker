import { extractGradeFromTitle, filterByGrade } from '../../../services/adapters/gradeUtils';
import { CompRequest } from '../../../types';

describe('extractGradeFromTitle', () => {
  it('extracts standard PSA grade', () => {
    expect(extractGradeFromTitle('2023 Topps Mike Trout PSA 10')).toEqual({ company: 'PSA', grade: '10' });
  });

  it('extracts BGS half grade', () => {
    expect(extractGradeFromTitle('2023 Topps Mike Trout BGS 9.5')).toEqual({ company: 'BGS', grade: '9.5' });
  });

  it('extracts CGC grade', () => {
    expect(extractGradeFromTitle('2020 Panini Tom Brady CGC 8')).toEqual({ company: 'CGC', grade: '8' });
  });

  it('extracts SGC grade', () => {
    expect(extractGradeFromTitle('1986 Fleer Michael Jordan SGC 9')).toEqual({ company: 'SGC', grade: '9' });
  });

  it('is case insensitive', () => {
    expect(extractGradeFromTitle('psa 10 Mike Trout')).toEqual({ company: 'PSA', grade: '10' });
    expect(extractGradeFromTitle('Psa 10 Mike Trout')).toEqual({ company: 'PSA', grade: '10' });
  });

  it('handles no space between company and grade', () => {
    expect(extractGradeFromTitle('Mike Trout PSA10 GEM MINT')).toEqual({ company: 'PSA', grade: '10' });
  });

  it('extracts Auth grade', () => {
    expect(extractGradeFromTitle('Tom Brady PSA Auth Signed')).toEqual({ company: 'PSA', grade: 'Auth' });
  });

  it('normalizes Authentic to Auth', () => {
    expect(extractGradeFromTitle('Tom Brady PSA Authentic')).toEqual({ company: 'PSA', grade: 'Auth' });
  });

  it('returns null when no grade present', () => {
    expect(extractGradeFromTitle('2023 Topps Mike Trout #1 Base')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractGradeFromTitle('')).toBeNull();
  });

  it('does not match non-grading abbreviations', () => {
    expect(extractGradeFromTitle('USA 10 Mike Trout Team Card')).toBeNull();
  });

  it('returns first match when multiple grades present', () => {
    expect(extractGradeFromTitle('PSA 10 BGS 9.5 Crossover')).toEqual({ company: 'PSA', grade: '10' });
  });

  it('extracts grade surrounded by text', () => {
    expect(extractGradeFromTitle('RARE 2023 Topps Mike Trout PSA 10 GEM MINT')).toEqual({ company: 'PSA', grade: '10' });
  });
});

describe('filterByGrade', () => {
  const mkSale = (title: string) => ({ title, price: 100, date: '2026-01-15' });

  it('returns all sales for ungraded request', () => {
    const sales = [mkSale('PSA 10 Trout'), mkSale('BGS 9.5 Trout'), mkSale('Raw Trout')];
    const request: CompRequest = { cardId: '1', player: 'Mike Trout', year: 2023, brand: 'Topps', cardNumber: '1' };
    expect(filterByGrade(sales, request)).toHaveLength(3);
  });

  it('returns all sales when gradingCompany is missing', () => {
    const sales = [mkSale('PSA 10 Trout'), mkSale('BGS 9.5 Trout')];
    const request: CompRequest = { cardId: '1', player: 'Mike Trout', year: 2023, brand: 'Topps', cardNumber: '1', isGraded: true, grade: '10' };
    expect(filterByGrade(sales, request)).toHaveLength(2);
  });

  it('returns all sales when grade is missing', () => {
    const sales = [mkSale('PSA 10 Trout'), mkSale('BGS 9.5 Trout')];
    const request: CompRequest = { cardId: '1', player: 'Mike Trout', year: 2023, brand: 'Topps', cardNumber: '1', isGraded: true, gradingCompany: 'PSA' };
    expect(filterByGrade(sales, request)).toHaveLength(2);
  });

  it('filters to matching grade when 3+ matches exist', () => {
    const sales = [
      mkSale('2023 Topps Trout PSA 10'),
      mkSale('2023 Topps Trout PSA 10 GEM'),
      mkSale('2023 Topps Trout PSA 10 Mint'),
      mkSale('2023 Topps Trout PSA 9'),
      mkSale('2023 Topps Trout BGS 10'),
    ];
    const request: CompRequest = {
      cardId: '1', player: 'Mike Trout', year: 2023, brand: 'Topps', cardNumber: '1',
      isGraded: true, gradingCompany: 'PSA', grade: '10',
    };
    const result = filterByGrade(sales, request);
    expect(result).toHaveLength(3);
    expect(result.every(s => s.title.includes('PSA 10'))).toBe(true);
  });

  it('falls back to all sales when fewer than 3 matches', () => {
    const sales = [
      mkSale('2023 Topps Trout PSA 10'),
      mkSale('2023 Topps Trout PSA 10 GEM'),
      mkSale('2023 Topps Trout PSA 9'),
      mkSale('2023 Topps Trout BGS 10'),
    ];
    const request: CompRequest = {
      cardId: '1', player: 'Mike Trout', year: 2023, brand: 'Topps', cardNumber: '1',
      isGraded: true, gradingCompany: 'PSA', grade: '10',
    };
    const result = filterByGrade(sales, request);
    expect(result).toHaveLength(4); // Only 2 PSA 10 matches, falls back
  });

  it('distinguishes company correctly (PSA 10 != BGS 10)', () => {
    const sales = [
      mkSale('Trout BGS 10'),
      mkSale('Trout BGS 10 Pristine'),
      mkSale('Trout BGS 10 Black Label'),
      mkSale('Trout PSA 10'),
    ];
    const request: CompRequest = {
      cardId: '1', player: 'Mike Trout', year: 2023, brand: 'Topps', cardNumber: '1',
      isGraded: true, gradingCompany: 'BGS', grade: '10',
    };
    const result = filterByGrade(sales, request);
    expect(result).toHaveLength(3);
    expect(result.every(s => s.title.includes('BGS 10'))).toBe(true);
  });

  it('matches case insensitively in titles', () => {
    const sales = [
      mkSale('Trout psa 10 gem'),
      mkSale('Trout PSA 10 mint'),
      mkSale('Trout Psa 10 nice'),
    ];
    const request: CompRequest = {
      cardId: '1', player: 'Mike Trout', year: 2023, brand: 'Topps', cardNumber: '1',
      isGraded: true, gradingCompany: 'PSA', grade: '10',
    };
    const result = filterByGrade(sales, request);
    expect(result).toHaveLength(3);
  });

  it('handles mixed graded and ungraded listings', () => {
    const sales = [
      mkSale('Trout PSA 10'),
      mkSale('Trout PSA 10 GEM'),
      mkSale('Trout PSA 10 MINT'),
      mkSale('Trout raw card no grade'),
      mkSale('Trout base card'),
    ];
    const request: CompRequest = {
      cardId: '1', player: 'Mike Trout', year: 2023, brand: 'Topps', cardNumber: '1',
      isGraded: true, gradingCompany: 'PSA', grade: '10',
    };
    const result = filterByGrade(sales, request);
    expect(result).toHaveLength(3);
    expect(result.every(s => s.title.includes('PSA 10'))).toBe(true);
  });
});
