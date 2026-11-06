import { hasBeenAwayTooLong, LOCK_AFTER_BACKGROUND_MS } from '@/lib/appLock';

describe('hasBeenAwayTooLong', () => {
  it('não trava quando o app não foi para segundo plano', () => {
    expect(hasBeenAwayTooLong(null, Date.now())).toBe(false);
  });

  it('trava só depois do tempo limite em segundo plano', () => {
    const left = 1_000_000;
    expect(hasBeenAwayTooLong(left, left + LOCK_AFTER_BACKGROUND_MS - 1)).toBe(false);
    expect(hasBeenAwayTooLong(left, left + LOCK_AFTER_BACKGROUND_MS)).toBe(true);
  });
});
