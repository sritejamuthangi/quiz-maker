import { describe, expect, it } from 'vitest';
import { answerMatches, normalizeAnswer, parseBlanks, textWithBlanks } from '../blanks.js';

describe('parseBlanks', () => {
  it('parses one blank', () => {
    const r = parseBlanks('The capital of France is [Paris].');
    expect(r.error).toBeNull();
    expect(r.blanks).toEqual([['Paris']]);
    expect(r.segments).toEqual([
      { type: 'text', value: 'The capital of France is ' },
      { type: 'blank', index: 0 },
      { type: 'text', value: '.' },
    ]);
  });

  it('parses several blanks with alternatives and trims them', () => {
    const r = parseBlanks('[ colour | color ] and [grey|gray|grey] at the start');
    expect(r.error).toBeNull();
    expect(r.blanks).toEqual([['colour', 'color'], ['grey', 'gray']]);
    expect(r.segments[0]).toEqual({ type: 'blank', index: 0 });
  });

  it('supports escaped brackets as literal text', () => {
    const r = parseBlanks('Array \\[0\\] holds [first]');
    expect(r.error).toBeNull();
    expect(r.blanks).toEqual([['first']]);
    expect(r.segments[0]).toEqual({ type: 'text', value: 'Array [0] holds ' });
  });

  it('reports helpful errors', () => {
    expect(parseBlanks('Missing [close').error).toMatch(/closing/);
    expect(parseBlanks('Stray ] bracket').error).toMatch(/without a matching/);
    expect(parseBlanks('Empty [] blank').error).toMatch(/empty/);
    expect(parseBlanks('Empty [ | ] blank').error).toMatch(/empty/);
    expect(parseBlanks('Nested [a [b]]').error).toMatch(/cannot contain/);
    expect(parseBlanks('[1][2][3][4][5][6][7][8][9][10][11]').error).toMatch(/at most 10/);
  });

  it('returns no blanks for plain text', () => {
    expect(parseBlanks('No blanks here').blanks).toEqual([]);
  });

  it('renders placeholders without revealing answers', () => {
    expect(textWithBlanks('Water is H[2]O and [oxygen] is O')).toBe('Water is H_____O and _____ is O');
  });
});

describe('normalizeAnswer', () => {
  it('ignores case, extra spaces and trailing punctuation', () => {
    expect(normalizeAnswer('  New   York.  ')).toBe('new york');
    expect(normalizeAnswer('PARIS!')).toBe('paris');
  });

  it('treats phone smart quotes and dashes like plain ones', () => {
    expect(normalizeAnswer('don’t')).toBe(normalizeAnswer("don't"));
    expect(normalizeAnswer('“quoted”')).toBe('"quoted"');
    expect(normalizeAnswer('x—y')).toBe('x-y');
  });

  it('keeps punctuation when it is the whole answer', () => {
    expect(normalizeAnswer('?')).toBe('?');
  });

  it('can be case-sensitive', () => {
    expect(normalizeAnswer('Au', true)).toBe('Au');
  });
});

describe('answerMatches', () => {
  it('matches any accepted alternative', () => {
    expect(answerMatches('Color', ['colour', 'color'])).toBe(true);
    expect(answerMatches('colr', ['colour', 'color'])).toBe(false);
  });

  it('never accepts an empty answer', () => {
    expect(answerMatches('', ['?'])).toBe(false);
    expect(answerMatches('   ', ['a'])).toBe(false);
    expect(answerMatches(undefined, ['a'])).toBe(false);
  });

  it('respects case sensitivity', () => {
    expect(answerMatches('au', ['Au'], true)).toBe(false);
    expect(answerMatches('Au', ['Au'], true)).toBe(true);
  });
});
