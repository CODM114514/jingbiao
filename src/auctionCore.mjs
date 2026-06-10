import { createHash } from 'node:crypto';

export function createDefaultAuction(overrides = {}) {
  const now = Date.now();
  return {
    title: '闲置资产竞租',
    description: '请按页面规则公开递增出价。',
    startingPrice: 500,
    minIncrement: 50,
    deposit: 0,
    rentalPeriod: '待填写',
    startsAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    participants: {},
    bids: [],
    ...overrides,
  };
}

export function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

export function validatePhone(phone) {
  const normalized = normalizePhone(phone);
  if (!/^\d{11}$/.test(normalized)) {
    throw new Error('Phone number must be 11 digits.');
  }
  return normalized;
}

function hashValue(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

function validatePassword(password) {
  if (String(password ?? '').length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  return String(password);
}

function validateSecurityText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  return text;
}

function verifyPassword(storedHash, password) {
  return storedHash === hashValue(password);
}

export function isAuctionStarted(auction, now = new Date().toISOString()) {
  const startsAt = auction.startsAt ?? '1970-01-01T00:00:00.000Z';
  return new Date(now).getTime() >= new Date(startsAt).getTime();
}

export function isAuctionClosed(auction, now = new Date().toISOString()) {
  return new Date(now).getTime() > new Date(auction.endsAt).getTime();
}

export function registerParticipant(auction, participant) {
  const now = participant.now ?? new Date().toISOString();
  if (isAuctionClosed(auction, now)) {
    throw new Error('This auction has ended.');
  }

  const phone = validatePhone(participant.phone);
  const name = String(participant.name ?? '').trim();
  if (!name) {
    throw new Error('Name is required.');
  }
  const password = validatePassword(participant.password);
  const securityQuestion = validateSecurityText(participant.securityQuestion, 'Security question');
  const securityAnswer = validateSecurityText(participant.securityAnswer, 'Security answer');

  if (auction.participants?.[phone]) {
    throw new Error('This phone number is already registered.');
  }

  return {
    ...auction,
    participants: {
      ...auction.participants,
      [phone]: {
        name,
        phone,
        passwordHash: hashValue(password),
        securityQuestion,
        securityAnswerHash: hashValue(securityAnswer),
        registeredAt: auction.participants?.[phone]?.registeredAt ?? now,
      },
    },
  };
}

export function authenticateParticipant(auction, credentials) {
  const phone = validatePhone(credentials.phone);
  const participant = auction.participants?.[phone];
  if (!participant) {
    throw new Error('Phone number is not registered.');
  }
  if (!verifyPassword(participant.passwordHash, credentials.password)) {
    throw new Error('Password is incorrect.');
  }
  return participant;
}

export function getParticipantSecurityQuestion(auction, phone) {
  const normalized = validatePhone(phone);
  const participant = auction.participants?.[normalized];
  if (!participant) {
    throw new Error('Phone number is not registered.');
  }
  return participant.securityQuestion;
}

export function resetPassword(auction, payload) {
  const phone = validatePhone(payload.phone);
  const answer = validateSecurityText(payload.securityAnswer, 'Security answer');
  const newPassword = validatePassword(payload.newPassword);
  const participant = auction.participants?.[phone];

  if (!participant) {
    throw new Error('Phone number is not registered.');
  }

  if (!verifyPassword(participant.securityAnswerHash, answer)) {
    throw new Error('Security answer is incorrect.');
  }

  return {
    ...auction,
    participants: {
      ...auction.participants,
      [phone]: {
        ...participant,
        passwordHash: hashValue(newPassword),
      },
    },
  };
}

export function getPhoneLast4(phone) {
  return validatePhone(phone).slice(-4);
}

export function getWinningBid(auction) {
  return (
    [...(auction.bids ?? [])].sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })[0] ?? null
  );
}

export function getMinimumNextBid(auction) {
  const winner = getWinningBid(auction);
  if (!winner) return Number(auction.startingPrice);
  return Number(winner.amount) + Number(auction.minIncrement);
}

export function placeBid(auction, bid) {
  const now = bid.now ?? new Date().toISOString();
  if (!isAuctionStarted(auction, now)) {
    throw new Error('This auction has not started.');
  }
  if (isAuctionClosed(auction, now)) {
    throw new Error('This auction has ended.');
  }

  const phone = validatePhone(bid.phone);
  const participant = auction.participants?.[phone];
  if (!participant) {
    throw new Error('Participant must register before bidding.');
  }
  if (!verifyPassword(participant.passwordHash, bid.password)) {
    throw new Error('Password is required or incorrect.');
  }

  const amount = Number(bid.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Bid amount must be a positive number.');
  }

  const minimum = getMinimumNextBid(auction);
  if (amount < minimum) {
    throw new Error(`Bid must be at least ${minimum}.`);
  }

  return {
    ...auction,
    bids: [
      ...(auction.bids ?? []),
      {
        id: `bid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        phone,
        amount,
        createdAt: now,
      },
    ],
  };
}

export function getPublicState(auction, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const startsAt = auction.startsAt ?? '1970-01-01T00:00:00.000Z';
  const winningBid = getWinningBid(auction);
  const bidHistory = [...(auction.bids ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      createdAt: bid.createdAt,
      phoneLast4: getPhoneLast4(bid.phone),
    }));

  return {
    title: auction.title,
    description: auction.description,
    startingPrice: Number(auction.startingPrice),
    minIncrement: Number(auction.minIncrement),
    deposit: Number(auction.deposit ?? 0),
    rentalPeriod: auction.rentalPeriod,
    startsAt,
    endsAt: auction.endsAt,
    isStarted: isAuctionStarted(auction, now),
    isClosed: isAuctionClosed(auction, now),
    canBid: isAuctionStarted(auction, now) && !isAuctionClosed(auction, now),
    currentPrice: winningBid?.amount ?? null,
    minimumNextBid: getMinimumNextBid(auction),
    currentWinnerPhoneLast4: winningBid ? getPhoneLast4(winningBid.phone) : null,
    bidHistory,
  };
}

export function getAdminState(auction, options = {}) {
  const publicState = getPublicState(auction, options);
  const participants = Object.values(auction.participants ?? {}).sort((a, b) =>
    a.registeredAt.localeCompare(b.registeredAt)
  ).map(({ name, phone, registeredAt }) => ({ name, phone, registeredAt }));
  const bids = [...(auction.bids ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((bid) => ({
      ...bid,
      name: auction.participants?.[bid.phone]?.name ?? '',
    }));
  const winner = getWinningBid(auction);

  return {
    ...publicState,
    participants,
    bids,
    winner: winner
      ? {
          ...winner,
          name: auction.participants?.[winner.phone]?.name ?? '',
        }
      : null,
  };
}

export function updateAuctionSettings(auction, settings) {
  const next = {
    ...auction,
    title: String(settings.title ?? auction.title).trim() || auction.title,
    description: String(settings.description ?? auction.description).trim() || auction.description,
    rentalPeriod: String(settings.rentalPeriod ?? auction.rentalPeriod).trim() || auction.rentalPeriod,
    startingPrice: Number(settings.startingPrice ?? auction.startingPrice),
    minIncrement: Number(settings.minIncrement ?? auction.minIncrement),
    deposit: Number(settings.deposit ?? auction.deposit ?? 0),
    startsAt: settings.startsAt ? new Date(settings.startsAt).toISOString() : auction.startsAt,
    endsAt: settings.endsAt ? new Date(settings.endsAt).toISOString() : auction.endsAt,
  };

  if (!Number.isFinite(next.startingPrice) || next.startingPrice < 0) {
    throw new Error('Starting price must be a non-negative number.');
  }
  if (!Number.isFinite(next.minIncrement) || next.minIncrement < 0) {
    throw new Error('Minimum increment must be a non-negative number.');
  }
  if (!Number.isFinite(next.deposit) || next.deposit < 0) {
    throw new Error('Deposit must be a non-negative number.');
  }
  if (Number.isNaN(new Date(next.startsAt).getTime())) {
    throw new Error('Start time is invalid.');
  }
  if (Number.isNaN(new Date(next.endsAt).getTime())) {
    throw new Error('Deadline is invalid.');
  }
  if (new Date(next.startsAt).getTime() >= new Date(next.endsAt).getTime()) {
    throw new Error('Start time must be before the deadline.');
  }

  return next;
}
