import { createFileRoute } from '@tanstack/react-router';

const PLAY_HEADING = 'Play';

const PlayPage = () => <h2>{PLAY_HEADING}</h2>;

export const Route = createFileRoute('/play/')({ component: PlayPage });
