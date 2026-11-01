import { describe, it, expect } from 'vitest';
import { CATEGORIES } from './categories.js';

// The way a moving thing goes (assets/MoveArrow): drawn going right, because the
// game mirrors walkers going left (setFlipX(facing < 0)) and turns projectiles
// by their flight angle (0 = right).
describe('which kinds show the way they go', () => {
  it('walkers and projectiles, nothing that stands still', () => {
    const moving = Object.fromEntries(Object.entries(CATEGORIES).filter(([, c]) => c.moves).map(([id, c]) => [id, c.moves]));
    expect(moving).toEqual({ hero: 'walks', enemy: 'walks', soldier: 'walks', projectile: 'flies' });
  });
});
