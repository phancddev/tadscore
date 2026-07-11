import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Team } from '../../lib/types';
import { QuickActions } from './QuickActions';
import type { ShopConfig } from './shopConfig';

afterEach(() => {
  cleanup();
});

const shop: ShopConfig = {
  piece: { medalCost: 140, medalDelta: -140, pieceDelta: 1, itemDelta: 0 },
  item: { medalCost: 90, medalDelta: -90, pieceDelta: 0, itemDelta: 1 },
  minimumPieces: 4,
  pieceLimit: { activityKey: 'big-game-2', max: 1, active: true },
};

const richTeam: Team = {
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
  shopPiecesBought: 0,
};

const poorTeam: Team = {
  ...richTeam,
  teamId: 'mai',
  id: 'mai',
  name: 'Mai',
  displayName: 'Nhà Mai',
  medals: 20,
  pieces: 0,
  shopPiecesBought: 0,
};

const boughtTeam: Team = {
  ...richTeam,
  teamId: 'cuc',
  id: 'cuc',
  name: 'Cúc',
  displayName: 'Nhà Cúc',
  shopPiecesBought: 1,
};

describe('QuickActions shop UX', () => {
  it('submits signed medal deltas and piece purchases when affordable', async () => {
    const user = userEvent.setup();
    const onQuick = vi.fn();
    const onPurchase = vi.fn();
    render(
      <QuickActions
        teams={[richTeam]}
        shop={shop}
        shopReady
        saving={false}
        onQuick={onQuick}
        onPurchase={onPurchase}
      />,
    );

    const delta = screen.getByLabelText('Mức thay đổi huy hiệu');
    await user.clear(delta);
    await user.type(delta, '-2');
    await user.click(screen.getByTestId('quick-submit'));
    expect(onQuick).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'lan', mode: 'manual', value: -2 }),
    );

    await user.click(screen.getByRole('tab', { name: /Mảnh ghép/i }));
    expect(screen.getByText(/điều kiện xếp hạng/i)).toBeTruthy();
    expect(screen.getByText(/Giá: 140 HH/i)).toBeTruthy();
    expect(screen.getByTestId('quick-submit')).toBeEnabled();
    await user.click(screen.getByTestId('quick-submit'));
    expect(onPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'lan', mode: 'piece', value: 1 }),
    );
  });

  it('blocks piece purchase when the team cannot afford it', async () => {
    const user = userEvent.setup();
    const onPurchase = vi.fn();
    render(
      <QuickActions
        teams={[poorTeam]}
        shop={shop}
        shopReady
        saving={false}
        onQuick={vi.fn()}
        onPurchase={onPurchase}
      />,
    );
    await user.click(screen.getByRole('tab', { name: /Mảnh ghép/i }));
    expect(screen.getByText(/Không đủ huy hiệu/i)).toBeTruthy();
    expect(screen.getByTestId('quick-submit')).toBeDisabled();
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('blocks piece purchase when shop limit is already used', async () => {
    const user = userEvent.setup();
    const onPurchase = vi.fn();
    render(
      <QuickActions
        teams={[boughtTeam]}
        shop={shop}
        shopReady
        saving={false}
        onQuick={vi.fn()}
        onPurchase={onPurchase}
      />,
    );
    await user.click(screen.getByRole('tab', { name: /Mảnh ghép/i }));
    expect(screen.getByText(/Limit shop:.*đã mua 1/i)).toBeTruthy();
    expect(screen.getByTestId('quick-submit')).toBeDisabled();
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('does not apply shop piece limit after gate activity is finalized', async () => {
    const user = userEvent.setup();
    const onPurchase = vi.fn();
    render(
      <QuickActions
        teams={[boughtTeam]}
        shop={{ ...shop, pieceLimit: { ...shop.pieceLimit!, active: false } }}
        shopReady
        saving={false}
        onQuick={vi.fn()}
        onPurchase={onPurchase}
      />,
    );
    await user.click(screen.getByRole('tab', { name: /Mảnh ghép/i }));
    expect(screen.getByText(/đã hết hiệu lực/i)).toBeTruthy();
    expect(screen.getByTestId('quick-submit')).toBeEnabled();
    await user.click(screen.getByTestId('quick-submit'));
    expect(onPurchase).toHaveBeenCalled();
  });

  it('blocks invalid medal input', async () => {
    const user = userEvent.setup();
    const onQuick = vi.fn();
    render(
      <QuickActions
        teams={[richTeam]}
        shop={shop}
        shopReady
        saving={false}
        onQuick={onQuick}
        onPurchase={vi.fn()}
      />,
    );
    const delta = screen.getByLabelText('Mức thay đổi huy hiệu');
    await user.clear(delta);
    await user.type(delta, '0');
    expect(screen.getByText(/không được bằng 0/i)).toBeTruthy();
    expect(screen.getByTestId('quick-submit')).toBeDisabled();
    expect(onQuick).not.toHaveBeenCalled();
  });
});
