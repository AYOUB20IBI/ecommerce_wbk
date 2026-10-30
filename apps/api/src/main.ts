// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 3000);
// }
// void bootstrap();



// import { NestFactory } from '@nestjs/core';
// import {
//   FastifyAdapter,
//   NestFastifyApplication,
// } from '@nestjs/platform-fastify';
// import fastifyCookie from '@fastify/cookie';
// import { AppModule } from './app.module';

// import fastifyHelmet from '@fastify/helmet';



// import fastifyMultipart from '@fastify/multipart';
// import fastifyStatic from '@fastify/static';
// import { resolve } from 'node:path';


// async function bootstrap() {
//   const app = await NestFactory.create<NestFastifyApplication>(
//     AppModule,
    
//     new FastifyAdapter({
//       bodyLimit: 1024 * 1024,
//     })

//   );

//   await app.register(fastifyCookie);

//   await app.register(fastifyHelmet);

//   app.setGlobalPrefix('api/v1');

  
//   const allowedOrigins = (
//     process.env.ALLOWED_ORIGINS ?? ''
//   )
//     .split(',')
//     .map((origin) => origin.trim())
//     .filter(Boolean);

//   if (allowedOrigins.length === 0) {
//     throw new Error('ALLOWED_ORIGINS is required');
//   }

//   app.enableCors({
//     origin: allowedOrigins,
//     credentials: true,
//     methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
//     allowedHeaders: [
//       'Content-Type',
//       'Authorization',
//       'X-CSRF-Token',
//     ],
//   });


  
//   await app.register(fastifyMultipart, {
//     limits: {
//       fileSize: 5 * 1024 * 1024,
//       files: 1,
//       fields: 0,
//       parts: 1,
//     },
//     throwFileSizeLimit: true,
//   });

//   // Only serve the dedicated media directory.
//   // Never serve the entire project folder.
//   if (
//     (process.env.MEDIA_STORAGE_DRIVER ?? 'local') ===
//     'local'
//   ) {
//     await app.register(fastifyStatic, {
//       root: resolve(
//         process.env.MEDIA_STORAGE_PATH ??
//           './storage/uploads',
//       ),
//       prefix: '/uploads/',
//       decorateReply: false,
//       index: false,
//       dotfiles: 'deny',
//     });
//   }


//   await app.listen(3001, '127.0.0.1');
// }

// void bootstrap();




import { NestFactory } from '@nestjs/core';

import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';

import { resolve } from 'node:path';

import { AppModule } from './app.module';

const MB = 1024 * 1024;

async function bootstrap() {
  const app =
    await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        bodyLimit: 22 * MB,
      }),
    );

  await app.register(fastifyCookie);

  await app.register(fastifyHelmet);

  app.setGlobalPrefix('api/v1');

  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ?? ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error(
      'ALLOWED_ORIGINS is required',
    );
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: [
      'GET',
      'POST',
      'PATCH',
      'PUT',
      'DELETE',
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
    ],
  });

  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 20 * MB,
      files: 1,
      fields: 0,
      parts: 1,
    },
    throwFileSizeLimit: true,
  });

  // Only public image storage is exposed
  // through the /uploads route.
  //
  // Private documents are never registered
  // with fastifyStatic.
  if (
    (process.env.MEDIA_STORAGE_DRIVER ?? 'local') ===
    'local'
  ) {
    await app.register(fastifyStatic, {
      root: resolve(
        process.env.MEDIA_STORAGE_PATH ??
          './storage/uploads',
      ),
      prefix: '/uploads/',
      decorateReply: false,
      index: false,
      dotfiles: 'deny',
    });
  }

  await app.listen(3001, '127.0.0.1');
}

void bootstrap();
