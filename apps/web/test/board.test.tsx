import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecommendationBanner } from '../src/features/play/advice/RecommendationBanner.tsx';
import { AdCard } from '../src/features/play/board/AdCard.tsx';
import { AdviceBadge } from '../src/features/play/board/AdviceBadge.tsx';
import { copy } from '../src/features/play/copy.ts';
import {
  BUY_POTION,
  IDLE_MOVES,
  STOP,
  TURN_VIEW,
  buildAdvisedAd,
  withVerdict,
} from './fixtures.ts';
import { renderWithQuery } from './render.tsx';

describe('ad board', () => {
  it.each([
    ['recommended', copy.board.verdict.recommended],
    ['long_shot', copy.board.verdict.long_shot],
    ['unattemptable', copy.board.verdict.unattemptable],
  ] as const)('labels a %s ad in words', (verdict, label) => {
    renderWithQuery(<AdCard ad={withVerdict({ verdict })} moves={IDLE_MOVES} />);

    expect(screen.getByText(label)).toBeVisible();
  });

  it('disables solving an unattemptable ad and says why', () => {
    renderWithQuery(<AdCard ad={withVerdict({ verdict: 'unattemptable' })} moves={IDLE_MOVES} />);

    expect(screen.getByRole('button', { name: /solve/i })).toBeDisabled();
    expect(screen.getByText(copy.board.unattemptableReason)).toBeVisible();
  });

  it('marks the recommended ad for assistive technology', () => {
    renderWithQuery(<AdCard ad={withVerdict({ verdict: 'recommended' })} moves={IDLE_MOVES} />);

    expect(screen.getByRole('article', { name: /recommended/i })).toBeVisible();
  });

  it('tags an ad that arrived encrypted', () => {
    renderWithQuery(<AdCard ad={buildAdvisedAd({ wasEncrypted: true })} moves={IDLE_MOVES} />);

    expect(screen.getByText(copy.board.decodedTag)).toBeVisible();
  });

  it('shows the estimate as a percentage and EV in gold', () => {
    renderWithQuery(
      <AdviceBadge
        advice={{ verdict: 'viable', estimatedProbability: 0.876, expectedValue: 21.4 }}
      />,
    );

    expect(screen.getByText('88%')).toBeVisible();
    expect(screen.getByText('+21 gold')).toBeVisible();
  });

  it.each([
    ['solve', TURN_VIEW.recommendation, TURN_VIEW.board[0]!.message],
    ['buy', BUY_POTION, copy.rules.survival_floor],
    ['buy', BUY_POTION, copy.advice.buy('Healing potion')],
    ['stop', STOP, copy.rules.no_viable_option],
  ])('explains a %s recommendation', (_kind, recommendation, text) => {
    renderWithQuery(<RecommendationBanner turn={{ ...TURN_VIEW, recommendation }} />);

    expect(screen.getByText(text, { exact: false })).toBeVisible();
  });
});
