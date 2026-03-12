import { describe, expect, it } from 'vitest';
import {
  CanonicalUnit,
  convertUnit,
  getUnitFamily,
} from '../src/constants/unitConversions.js';

describe('getUnitFamily', () => {
  it('returns volume for ml', () => {
    expect(getUnitFamily(CanonicalUnit.Ml)).toBe('volume');
  });

  it('returns volume for cup', () => {
    expect(getUnitFamily(CanonicalUnit.Cup)).toBe('volume');
  });

  it('returns weight for g', () => {
    expect(getUnitFamily(CanonicalUnit.G)).toBe('weight');
  });

  it('returns weight for lb', () => {
    expect(getUnitFamily(CanonicalUnit.Lb)).toBe('weight');
  });

  it('returns count for piece', () => {
    expect(getUnitFamily(CanonicalUnit.Piece)).toBe('count');
  });
});

describe('convertUnit', () => {
  it('returns same quantity when units are identical', () => {
    expect(convertUnit(100, CanonicalUnit.Ml, CanonicalUnit.Ml)).toBe(100);
  });

  it('converts ml to l correctly', () => {
    expect(convertUnit(1000, CanonicalUnit.Ml, CanonicalUnit.L)).toBeCloseTo(1);
  });

  it('converts l to ml correctly', () => {
    expect(convertUnit(1, CanonicalUnit.L, CanonicalUnit.Ml)).toBeCloseTo(1000);
  });

  it('converts tsp to ml correctly', () => {
    expect(convertUnit(1, CanonicalUnit.Tsp, CanonicalUnit.Ml)).toBeCloseTo(4.929, 2);
  });

  it('converts g to kg correctly', () => {
    expect(convertUnit(500, CanonicalUnit.G, CanonicalUnit.Kg)).toBeCloseTo(0.5);
  });

  it('converts oz to g correctly', () => {
    expect(convertUnit(1, CanonicalUnit.Oz, CanonicalUnit.G)).toBeCloseTo(28.35, 1);
  });

  it('returns null for cross-family conversion (volume to weight)', () => {
    expect(convertUnit(100, CanonicalUnit.Ml, CanonicalUnit.G)).toBeNull();
  });

  it('returns null for cross-family conversion (weight to count)', () => {
    expect(convertUnit(100, CanonicalUnit.G, CanonicalUnit.Piece)).toBeNull();
  });

  it('returns null for count-to-count different units', () => {
    expect(convertUnit(1, CanonicalUnit.Piece, CanonicalUnit.Slice)).toBeNull();
  });
});
