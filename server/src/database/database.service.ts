import * as schema from './schema';
import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class DatabaseService<
  TSchema extends Record<string, unknown> = typeof schema,
> {
  constructor(public readonly db: NodePgDatabase<TSchema>) {}
}
