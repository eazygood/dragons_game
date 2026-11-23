import { dbRepository } from './db.ts';
import { mugloarRepository } from './mugloar.ts';

export const gameRunRepository = { db: dbRepository, mugloar: mugloarRepository };
