import { NestFactory } from '@nestjs/core'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '@src/app.module'
import { newFastifyAdapter } from '@src/fastify'

/**
 * Bootstrap AppModule and start on port 3000
 */
async function bootstrap (): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(),
    newFastifyAdapter()
  )
  await app.listen(3000, '0.0.0.0')
}

/* eslint-disable no-void */
void bootstrap()