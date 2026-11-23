import { databaseConfig } from './src/adapters/mysql-adapter.ts';
import { loadConfig } from './src/config/index.ts';

export default databaseConfig({ config: loadConfig({ env: process.env }) });
