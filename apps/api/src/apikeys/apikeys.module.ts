import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from './apikey.schema';
import { ApiKeysService } from './apikeys.service';
import { ApiKeysController } from './apikeys.controller';
import { ApiKeyGuard } from '../common/api-key.guard';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }])],
  providers: [ApiKeysService, ApiKeyGuard],
  controllers: [ApiKeysController],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
