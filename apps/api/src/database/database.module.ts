
import { Global, Module } from '@nestjs/common';
import { DATABASE, databaseProvider } from './database.provider';

@Global()
@Module({
  providers: [databaseProvider],
  exports: [DATABASE],
})
export class DatabaseModule {}
