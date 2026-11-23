import { dbRepository } from './db.ts';
import { mugloarRepository } from './mugloar.ts';

export const purchaseRepository = { db: dbRepository, mugloar: mugloarRepository };
