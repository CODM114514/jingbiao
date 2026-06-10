import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultAuction,
  getPublicState,
  placeBid,
  registerParticipant,
  updateAuctionSettings,
} from '../src/auctionCore.mjs';

function registerWithCredentials(auction, payload = {}) {
  return registerParticipant(auction, {
    password: '123456',
    securityQuestion: 'my question',
    securityAnswer: 'my answer',
    ...payload,
  });
}

test('masks phone numbers to last four digits in public bid history', () => {
  let auction = createDefaultAuction({
    startingPrice: 500,
    minIncrement: 50,
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2099-01-01T00:00:00.000Z',
  });
  auction = registerWithCredentials(auction, { name: 'Zhang San', phone: '13812342468' });
  auction = placeBid(auction, {
    phone: '13812342468',
    password: '123456',
    amount: 500,
    now: '2026-06-07T10:00:00.000Z',
  });

  const state = getPublicState(auction, { now: '2026-06-07T10:01:00.000Z' });

  assert.equal(state.bidHistory[0].phoneLast4, '2468');
  assert.equal(state.bidHistory[0].phone, undefined);
  assert.equal(state.currentPrice, 500);
});

test('requires the first bid to meet starting price and later bids to meet minimum increment', () => {
  let auction = createDefaultAuction({
    startingPrice: 500,
    minIncrement: 50,
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2099-01-01T00:00:00.000Z',
  });
  auction = registerWithCredentials(auction, { name: 'Li Si', phone: '13912348120' });

  assert.throws(() => {
    placeBid(auction, {
      phone: '13912348120',
      password: '123456',
      amount: 490,
      now: '2026-06-07T10:00:00.000Z',
    });
  }, /at least 500/);

  auction = placeBid(auction, {
    phone: '13912348120',
    password: '123456',
    amount: 500,
    now: '2026-06-07T10:01:00.000Z',
  });

  assert.throws(() => {
    placeBid(auction, {
      phone: '13912348120',
      password: '123456',
      amount: 520,
      now: '2026-06-07T10:02:00.000Z',
    });
  }, /at least 550/);
});

test('rejects bids after the deadline', () => {
  let auction = createDefaultAuction({
    startingPrice: 300,
    minIncrement: 20,
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2026-06-07T12:00:00.000Z',
  });
  auction = registerWithCredentials(auction, {
    name: 'Wang Wu',
    phone: '18600000935',
    now: '2026-06-07T11:00:00.000Z',
  });

  assert.throws(() => {
    placeBid(auction, {
      phone: '18600000935',
      password: '123456',
      amount: 300,
      now: '2026-06-07T12:00:01.000Z',
    });
  }, /ended/);
});

test('allows registration before start but rejects bids before the bidding start time', () => {
  let auction = createDefaultAuction({
    startingPrice: 300,
    minIncrement: 20,
    startsAt: '2026-06-07T13:00:00.000Z',
    endsAt: '2026-06-07T18:00:00.000Z',
  });
  auction = registerWithCredentials(auction, {
    name: 'Before Start',
    phone: '13700001234',
    now: '2026-06-07T12:00:00.000Z',
  });

  assert.throws(() => {
    placeBid(auction, {
      phone: '13700001234',
      password: '123456',
      amount: 300,
      now: '2026-06-07T12:30:00.000Z',
    });
  }, /not started/);

  const state = getPublicState(auction, { now: '2026-06-07T12:30:00.000Z' });
  assert.equal(state.isStarted, false);
  assert.equal(state.canBid, false);
});

test('rejects registration after the deadline', () => {
  const auction = createDefaultAuction({
    startsAt: '2026-06-07T10:00:00.000Z',
    endsAt: '2026-06-07T12:00:00.000Z',
  });

  assert.throws(() => {
    registerWithCredentials(auction, {
      name: 'Late User',
      phone: '13700005678',
      now: '2026-06-07T12:00:01.000Z',
    });
  }, /ended/);
});

test('updates and exposes the bidding start time in auction settings', () => {
  const auction = createDefaultAuction({
    startsAt: '2026-06-07T10:00:00.000Z',
    endsAt: '2026-06-07T12:00:00.000Z',
  });

  const updated = updateAuctionSettings(auction, {
    startsAt: '2026-06-08T10:00:00.000Z',
    endsAt: '2026-06-08T12:00:00.000Z',
  });
  const state = getPublicState(updated, { now: '2026-06-08T09:00:00.000Z' });

  assert.equal(state.startsAt, '2026-06-08T10:00:00.000Z');
  assert.equal(state.isStarted, false);
});

test('allows repeated bidding and picks earliest bid when the amount ties', () => {
  let auction = createDefaultAuction({
    startingPrice: 100,
    minIncrement: 0,
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2099-01-01T00:00:00.000Z',
  });
  auction = registerWithCredentials(auction, { name: 'A', phone: '13800000001' });
  auction = registerWithCredentials(auction, { name: 'B', phone: '13800000002' });
  auction = placeBid(auction, {
    phone: '13800000001',
    password: '123456',
    amount: 200,
    now: '2026-06-07T10:00:00.000Z',
  });
  auction = placeBid(auction, {
    phone: '13800000002',
    password: '123456',
    amount: 200,
    now: '2026-06-07T10:01:00.000Z',
  });

  const state = getPublicState(auction, { now: '2026-06-07T10:02:00.000Z' });

  assert.equal(state.currentWinnerPhoneLast4, '0001');
  assert.equal(state.bidHistory.length, 2);
});
