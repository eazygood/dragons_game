import { createFileRoute } from '@tanstack/react-router';

const GamePage = () => <p>{Route.useParams().gameId}</p>;

export const Route = createFileRoute('/play/$gameId')({ component: GamePage });
