import { Module } from '@afilmory/framework'
import { DatabaseModule } from 'core/database/database.module'

import { TenantModule } from '../tenant/tenant.module'
import { FeaturedGalleriesController } from './featured-galleries.controller'
import { FeaturedGalleriesService } from './featured-galleries.service'

@Module({
  imports: [DatabaseModule, TenantModule],
  controllers: [FeaturedGalleriesController],
  providers: [FeaturedGalleriesService],
})
export class FeaturedGalleriesModule {}
