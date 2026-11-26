import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecommendationBanner } from '../src/features/play/advice/RecommendationBanner.tsx';
import { AdBoard } from '../src/features/play/board/AdBoard.tsx';
import { AdCard } from '../src/features/play/board/AdCard.tsx';
import { AdviceBadge } from '../src/features/play/board/AdviceBadge.tsx';
import { playCopy } from '../src/features/play/play-copy.ts';
import {
  BUY_POTION,
  IDLE_MOVE_ACTIONS,
  STOP,
  SURE_AD_MESSAGE,
  TURN_VIEW,
  buildAdvisedAd,
  withVerdict,
} from './fixtures.ts';
import { renderWithQuery } from './render.tsx';

describe('ad board', () => {
  it.each([
    ['recommended', playCopy.board.verdict.recommended],
    ['long_shot', playCopy.board.verdict.long_shot],
    ['unattemptable', playCopy.board.verdict.unattemptable],
  ] as const)('labels a %s ad in words', (verdict, label) => {
    renderWithQuery(<AdCard ad={withVerdict({ verdict })} moveActions={IDLE_MOVE_ACTIONS} />);

    expect(screen.getByText(label)).toBeVisible();
  });

  it('disables solving an unattemptable ad and says why', () => {
    renderWithQuery(
      <AdCard ad={withVerdict({ verdict: 'unattemptable' })} moveActions={IDLE_MOVE_ACTIONS} />,
    );

    const solveButton = screen.getByRole('button', { name: /solve/i });

    expect(solveButton).toBeDisabled();
    expect(screen.getByText(playCopy.board.unattemptableReason)).toBeVisible();
    expect(solveButton).toHaveAccessibleDescription(playCopy.board.unattemptableReason);
  });

  it('names the solve button after its ad without also naming the card', () => {
    renderWithQuery(
      <AdCard ad={withVerdict({ verdict: 'recommended' })} moveActions={IDLE_MOVE_ACTIONS} />,
    );

    expect(screen.getByRole('article')).not.toHaveAccessibleName();
    expect(screen.getByRole('button', { name: /solve: help defend the village/i })).toBeVisible();
  });

  it('labels the upstream rating instead of showing it bare', () => {
    renderWithQuery(
      <AdCard ad={buildAdvisedAd({ probability: 'Sure thing' })} moveActions={IDLE_MOVE_ACTIONS} />,
    );

    expect(screen.getByText(`${playCopy.board.probabilityLabel}: Sure thing`)).toBeVisible();
  });

  it.each([
    [1, 'Expires in 1 turn'],
    [2, 'Expires in 2 turns'],
  ])('words an ad expiring in %i turn(s) correctly', (turns, text) => {
    renderWithQuery(
      <AdCard ad={buildAdvisedAd({ expiresIn: turns })} moveActions={IDLE_MOVE_ACTIONS} />,
    );

    expect(screen.getByText(text)).toBeVisible();
  });

  it('says so when the board is empty', () => {
    renderWithQuery(<AdBoard board={[]} moveActions={IDLE_MOVE_ACTIONS} />);

    expect(screen.getByText(playCopy.board.empty)).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('tags an ad that arrived encrypted', () => {
    renderWithQuery(
      <AdCard ad={buildAdvisedAd({ wasEncrypted: true })} moveActions={IDLE_MOVE_ACTIONS} />,
    );

    expect(screen.getByText(playCopy.board.decodedTag)).toBeVisible();
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
    { name: 'solve ad', recommendation: TURN_VIEW.recommendation, text: SURE_AD_MESSAGE },
    { name: 'buy reason', recommendation: BUY_POTION, text: playCopy.rules.survival_floor },
    { name: 'buy item', recommendation: BUY_POTION, text: playCopy.advice.buy('Healing potion') },
    { name: 'stop reason', recommendation: STOP, text: playCopy.rules.no_viable_option },
  ])('explains the $name of a recommendation', ({ recommendation, text }) => {
    renderWithQuery(<RecommendationBanner turnView={{ ...TURN_VIEW, recommendation }} />);

    expect(screen.getByText(text, { exact: false })).toBeVisible();
  });
});
