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

describe('QuickActions manual entry', () => {
  it('submits signed medal deltas and purchase quantities', async () => {
    const user = userEvent.setup();
    const onQuick = vi.fn();
    const onPurchase = vi.fn();
    render(
      <QuickActions teams={[team]} saving={false} onQuick={onQuick} onPurchase={onPurchase} />,
    );

    const delta = screen.getByLabelText('Mức thay đổi huy hiệu');
    await user.clear(delta);
    await user.type(delta, '-2');
    await user.click(screen.getByRole('button', { name: 'Ghi nhận điểm' }));
    expect(onQuick).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'lan', mode: 'manual', value: -2 }),
    );

    await user.click(screen.getByRole('button', { name: 'Mảnh ghép' }));
    expect(screen.getByRole('spinbutton').getAttribute('min')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Xác nhận mua' }));
    expect(onPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'lan', mode: 'piece', value: 1 }),
    );
  });

  it('blocks invalid medal input', async () => {
    const user = userEvent.setup();
    const onQuick = vi.fn();
    render(<QuickActions teams={[team]} saving={false} onQuick={onQuick} onPurchase={vi.fn()} />);
    const delta = screen.getByLabelText('Mức thay đổi huy hiệu');
    await user.clear(delta);
    await user.type(delta, '0');
    expect(screen.getByText(/không được bằng 0/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ghi nhận điểm' })).toBeDisabled();
    expect(onQuick).not.toHaveBeenCalled();
  });
});
