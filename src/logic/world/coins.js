// Coins on the ground: picking up and vanishing.
// Methods of World (../world.js mixes them in); `this` is the World.

import { dist } from './shared.js';

export class Coins {
  updateCoins() {
    const h = this.hero;
    const keep = [];
    for (const c of this.coinsOnGround) {
      if (this.time - c.born >= this.b.coinLifetime) {
        this.emit('coinExpired', { id: c.id });
        continue;
      }
      if (!h.dead && dist(h, c) <= this.b.coinPickupRadius) {
        this.coins += c.value ?? 1;
        this.emit('coinPicked', { id: c.id, x: c.x, y: c.y, value: c.value ?? 1 });
        continue;
      }
      keep.push(c);
    }
    this.coinsOnGround = keep;

    // weapon chests: picked up like coins, opened at once
    this.chests = this.chests.filter((c) => {
      if (this.time - c.born >= this.b.chestLifetime) return false;
      if (h.dead || dist(h, c) > this.b.coinPickupRadius + 6) return true;
      this.emit('chestOpened', { ...this.openChest(), x: c.x, y: c.y });
      return false;
    });
  }
}
