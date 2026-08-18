import type { Difficulty } from './config';

export interface PlayerStats {
  hp: number;
  maxHp: number;
  gas: number;
  maxGas: number;
  blades: number;
  maxBlades: number;
  kills: number;
  score: number;
  wave: number;
  alive: boolean;
}

export interface MatchResult {
  kills: number;
  score: number;
  wave: number;
  durationSec: number;
  difficulty: Difficulty;
}

export interface ScoutProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  provider: 'guest' | 'google' | 'phone';
  scoutPass: boolean;
  bestScore: number;
  titanKills: number;
}

export interface Hookable {
  id: number;
  kind: 'tree' | 'building' | 'wall' | 'pole' | 'titan';
  /** World-space AABB */
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export type GameScreen =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'dead'
  | 'auth'
  | 'shop'
  | 'settings'
  | 'profile';
