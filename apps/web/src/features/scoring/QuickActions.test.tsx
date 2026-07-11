import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Team } from '../../lib/types';
import { QuickActions } from './QuickActions';

const team: Team = {
  id: 'lan',
  teamId: 'lan',
  code: 'lan',
  name: 'Lan',
  displayName: 'Nhà Lan',
  medals: 200,
  pieces: 1,
  items: 0,
  eligible: false,
  rank: 1,
};

describe('QuickActions rule controls', () => {
  it('keeps speech fixed at +1 and violations limited to the rule values', async () => {
    const user = userEvent.setup();
    render(<QuickActions teams={[team]} saving={false} onQuick={vi.fn()} onPurchase={vi.fn()} />);
    expect(screen.getByText('+1 huy hiệu theo bộ luật')).toBeTruthy();
    expect(screen.queryByRole('spinbutton')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Vi phạm' }));
    expect(screen.getByRole('button', { name: '−1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '−2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '−5' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Mảnh ghép' }));
    expect(screen.getByRole('spinbutton').getAttribute('min')).toBe('1');
  });
});
