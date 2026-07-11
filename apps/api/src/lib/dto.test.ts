import { describe, expect, it } from 'vitest';
import { camelize } from './dto.js';

describe('camelize', () => {
  it('maps nested database DTO keys without changing dates', () => {
    const date = new Date();
    expect(camelize({ full_name: 'A', nested_rows: [{ team_id: '1' }], created_at: date })).toEqual(
      {
        fullName: 'A',
        nestedRows: [{ teamId: '1' }],
        createdAt: date,
      },
    );
  });
});
