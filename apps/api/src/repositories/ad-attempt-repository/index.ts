import { dbRepository } from './db.ts';
import { mugloarRepository } from './mugloar.ts';

export const adAttemptRepository = { db: dbRepository, mugloar: mugloarRepository };
