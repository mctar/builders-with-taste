import { z } from 'zod';
export const PHASES = ['Get ready', 'Build', 'Reflect', 'Make it yours', 'Your card', 'Reflect again'];
export const SCALE = [['Magic button', 'I hand it over'], ['Centaur', 'We split the work'], ['Cyborg', 'We think as one']];
export const TWISTS = ['for people who have never met', "for people who don’t share a language", 'that only works at night', 'for people who disagree', 'that works without electricity', 'for a city 100 years from now', 'that fits in a pocket', 'for strangers on a train', 'for one minute a day', 'for people of all ages at once', 'that moves', 'that makes a sound', 'in the middle of a forest', 'for a rainy Monday morning', 'for people waiting in line', 'that grows over time', 'for neighbours who never talk', 'for a place where everyone is in a hurry'];
export const CARD_PHASE = [-1, 0, 1, 1, 1, 2, 3, 4, 5, 5];
export const answerPatch = z.object({
  before: z.number().int().min(0).max(2).optional(), after: z.number().int().min(0).max(2).optional(),
  works: z.enum(['Yes', 'Partly', 'No']).optional(), feel: z.enum(['Easy', 'Mixed', 'Uncomfortable']).optional(),
  share: z.boolean().optional(), progress: z.number().int().min(0).max(9).optional(),
  twist: z.enum(TWISTS as [string, ...string[]]).optional()
}).strict();
export const mutation = z.object({ operationId: z.uuid(), expectedRevision: z.number().int().nonnegative(), patch: answerPatch }).strict();
export const cardInput = z.object({
  operationId: z.uuid(), expectedRevision: z.number().int().nonnegative(), consentVersion: z.number().int().nonnegative(),
  kind: z.enum(['build', 'concept']), title: z.string().trim().max(100).default(''),
  description: z.string().trim().max(600).default(''), mine: z.string().trim().max(240).default(''),
  assetId: z.uuid().nullable().default(null)
}).strict();
export type Answers = z.infer<typeof answerPatch>;
export type Session = { id: string; code: string; title: string; phase: number; revision: number; closed: boolean; galleryPaused: boolean; stageView: string; endsAt: string | null; remainingMs: number | null; serverTime: string };
export type Participant = { id: string; revision: number; consentVersion: number; data: Answers };
export type Card = { id: string; kind: string; title: string; description: string; mine: string; assetId: string | null; hidden: boolean; updatedAt: string; twist: string };
export type Snapshot = { session: Session; total: number; before: number[]; after: number[]; paired: number; transitions: number[][]; works: Record<string, number>; feel: Record<string, number>; progress: number[]; gallery: Card[]; capturedAt: string };
