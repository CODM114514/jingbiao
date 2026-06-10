import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { createDefaultAuction } from './auctionCore.mjs';

export class JsonAuctionStore {
  constructor(dataFile, defaultAuction = {}) {
    this.dataFile = dataFile;
    this.defaultAuction = defaultAuction;
  }

  async load() {
    try {
      const raw = await readFile(this.dataFile, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const auction = createDefaultAuction(this.defaultAuction);
      await this.save(auction);
      return auction;
    }
  }

  async save(auction) {
    await mkdir(dirname(this.dataFile), { recursive: true });
    await writeFile(this.dataFile, JSON.stringify(auction, null, 2), 'utf8');
  }

  async update(mutator) {
    const current = await this.load();
    const next = await mutator(current);
    await this.save(next);
    return next;
  }
}
