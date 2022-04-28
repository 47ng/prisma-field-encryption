<h1 align="center"><code>prisma-field-encryption</code></h1>

<div align="center">

[![NPM](https://img.shields.io/npm/v/prisma-field-encryption?color=red)](https://www.npmjs.com/package/prisma-field-encryption)
[![MIT License](https://img.shields.io/github/license/47ng/prisma-field-encryption.svg?color=blue)](https://github.com/47ng/prisma-field-encryption/blob/main/LICENSE)
[![Continuous Integration](https://github.com/47ng/prisma-field-encryption/workflows/Continuous%20Integration/badge.svg?branch=next)](https://github.com/47ng/prisma-field-encryption/actions)
[![Coverage Status](https://coveralls.io/repos/github/47ng/prisma-field-encryption/badge.svg?branch=next)](https://coveralls.io/github/47ng/prisma-field-encryption?branch=next)

</div>

<p align="center">Transparent field-level encryption at rest for Prisma.</p>

## Context

[Demo repository](https://github.com/franky47/prisma-field-encryption-sandbox).

See this [Twitter thread](https://twitter.com/fortysevenfx/status/1463265166682898438) for more information.

## Installation

```shell
$ yarn add prisma-field-encryption
# or
$ npm i prisma-field-encryption
```

> _Note: this requires Prisma 3.8.0 or higher._

## Usage

### 1. Add the middleware to your Prisma client

```ts
import { PrismaClient } from '@prisma/client'
import { fieldEncryptionMiddleware } from 'prisma-field-encryption'

export const client = new PrismaClient()

// This is a function, don't forget to call it:
client.$use(fieldEncryptionMiddleware())
```

_Tip: place the middleware as low as you need cleartext data._

_Any middleware registered after field encryption will receive encrypted data for the selected fields._

### 2. Setup your encryption key

Generate an encryption key:

- Via a web UI: [cloak.47ng.com](https://cloak.47ng.com)
- Via the command line:

```shell
$ cloak generate
```

> _Note: the `cloak` CLI comes pre-installed with `prisma-field-encryption` as part of the [`@47ng/cloak`](https://github.com/47ng/cloak) dependency._

The preferred method to provide your key is via the `PRISMA_FIELD_ENCRYPTION_KEY`
environment variable:

```shell
# .env
PRISMA_FIELD_ENCRYPTION_KEY=k1.aesgcm256.DbQoar8ZLuUsOHZNyrnjlskInHDYlzF3q6y1KGM7DUM=
```

You can also pass it directly in the configuration:

```ts
client.$use(
  fieldEncryptionMiddleware({
    // Don't version hardcoded keys though, this is an example:
    encryptionKey: 'k1.aesgcm256.DbQoar8ZLuUsOHZNyrnjlskInHDYlzF3q6y1KGM7DUM='
  })
)
```

_Tip: a key provided in code will take precedence over a key from the environment._

### 3. Annotate your schema

In your Prisma schema, add `/// @encrypted` to the fields you want to encrypt:

```prisma
model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String? /// @encrypted <- annotate fields to encrypt
  published Boolean @default(false)
  author    User?   @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  authorId  Int?
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String? /// @encrypted <- can be optional
  posts Post[]
}
```

_Tip: make sure you use a triple-slash. Double slash comments won't work._

### 4. Regenerate your client

Make sure you have a generator for the Prisma client:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

Then generate it using the `prisma` CLI:

```shell
$ prisma generate
```

You're done!

## Migrations

Adding encryption to an existing field is a transparent operation: Prisma will
encrypt data on new writes, and decrypt on read when data is encrypted, but
your existing data will remain in clear text.

Encrypting existing data should be done in a migration. The package comes with
a built-in automatic migration generator, in the form of a Prisma generator:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["interactiveTransactions"]
}

generator fieldEncryptionMigrations {
  provider = "prisma-field-encryption"
  output   = "./where/you/want/your/migrations"
}
```

_Tip: the migrations generator makes use of the `interactiveTransactions` preview feature. Make sure it's enabled on your Prisma Client generator._

Your migrations directory will contain:

- One migration per model
- An `index.ts` file that runs them all concurrently

All migrations files follow the same API:

```ts
export async function migrate(
  client: PrismaClient,
  reportProgress?: ProgressReportCallback
)
```

The progress report callback is optional, and will log progress to the console
if ommitted.

### Following Migrations Progress

A progress report is an object with the following fields:

- `model`: The model name
- `processed`: How many records have been processed
- `totalCount`: How many records were present at the start of the migration
- `performance`: How long it took to update the last record (in ms)

Note: because the totalCount is only computed once, additions or deletions
while a migration is running may cause the final processedCount to not equal
totalCount.

### Custom Cursors

Records will be iterated upon by increasing order of a **cursor** field.

A cursor field has to respect the following constraints:

- Be `@unique`
- Not be encrypted itself

By default, records will try to use the `@id` field.

> Note: Compound `@@id` primary keys are not supported.

If the `@id` field does not satisfy cursor constraints, the generator will
fallback to the first field that satisfies those constraints.

If you wish to iterate over another field, you can do so by annotating the
desired field with `@encryption:cursor`:

```prisma
model User {
  id     Int    @id       // Generator would use this by default
  email  String @unique  /// @encryption:cursor <- iterate over this field instead
}
```

Migrations will look for cursor fields in your models in this order:

1. Fields explictly annotated with `@encryption:cursor`
2. The `@id` field
3. The first `@unique` field

If no cursor is found for a model with encrypted fields, the generator will
throw an error when running `prisma generate`.

## Key Management

This library is based on [@47ng/cloak](https://github.com/47ng/cloak), which comes
with key management built-in. Here are the basic principles:

- You have one current encryption key
- You can have many decryption keys for existing data

This allows seamless rotation of the encryption key:

1. Generate a new encryption key
2. Add the old one to the decryption keys

The `PRISMA_FIELD_DECRYPTION_KEYS` can contain a comma-separated list of keys
to use for decryption:

```shell
PRISMA_FIELD_DECRYPTION_KEYS=key1,key2,key3
```

Or specify keys programmatically:

```ts
prismaClient.$use(
  fieldEncryptionMiddleware({
    decryptionKeys: [
      'k1.aesgcm256.DbQoar8ZLuUsOHZNyrnjlskInHDYlzF3q6y1KGM7DUM='
      // Add other keys here. Order does not matter.
    ]
  })
)
```

_Tip: the current encryption key is already part of the decryption keys, no need to add it there._

Key rotation on existing fields (decrypt with old key and re-encrypt with the
new one) is done by [data migrations](#migrations).

**Roadmap:**

- [x] Provide multiple decryption keys
- [x] Add facilities for migrations & key rotation
- [ ] Add compatibility with [@47ng/cloak](https://github.com/47ng/cloak) keychain environments

## Caveats & Limitations

You can only encrypt `String` fields.

You cannot filter on encrypted fields:

```ts
// User.name has an /// @encrypted annotation

// This will always return empty results:
prisma.user.findUnique({ where: { name: 'secret' } })
```

This is because the encryption is not deterministic: encrypting the same input multiple times will yield different outputs, due to the use of random initialisation vectors. Therefore Prisma cannot match the query to the data.

For the same reason, indexes should not be placed on encrypted fields.

[Raw database access](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)
operations are not supported.

Adding encryption adds overhead, both in storage space and in time to run queries,
though its impact hasn't been measured yet.

## How Does This Work ?

The middleware reads the Prisma AST (DMMF) to find annotations (only triple-slash
comments make it there) and build a list of encrypted Model.field pairs.

When a query is received, if there's input data to encrypt (write operations),
the relevant fields are encrypted. Then the encrypted data is sent to the
database.

Data returned from the database is scanned for encrypted fields, and those are
attempted to be decrypted. Errors will be logged and any unencrypted data will
be passed through, allowing seamless setup.

The generated data migrations files iterate over models that contain encrypted
fields, record by record, using the `interactiveTransaction` preview feature to
ensure that a record is not overwritten by other concurrent updates.

Because of the transparent encryption provided by the middleware, iterating over
records looks like a no-op (reading then updating with the same data), but this
will take care of:

- Encrypting fields newly `/// @encrypted`
- Rotating the encryption key when it changed
- Decrypting fields where encryption is being disabled with `/// @encrypted?readonly`. Once that migration has run, you can remove the annotation on those fields.

## Do I Need This ?

Some data is sensitive, and it's easy to give read access to the database to
a contractor or have backups end up somewhere they shouldn't be.

For those cases, encrypting the data per-field can make sense.

An example use-case is Two Factor authentication TOTP secrets: your app needs
them to authenticate your users, but nobody else should have access to them.

## Cryptography

Cipher used: AES-GCM with 256 bit keys.

## Obligatory Disclaimer About Passwords

🚨 **DO NOT USE THIS TO ENCRYPT PASSWORDS WITHOUT ADDITIONAL SECURITY MEASURES** 🚨

Passwords should be hashed & salted using a slow, constant-time one-way function. However, this library could be used to encrypt the salted and hashed password as a [pepper](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#peppering) to provide an additional layer of security. It is recommended that the encryption key be stored in a [Hardware Security Module](https://en.wikipedia.org/wiki/Hardware_security_module) on the server.

For hashing passwords, don't reinvent the wheel: use Argon2id if you can, otherwise scrypt.

## License

[MIT](./LICENSE) - Made with ❤️ by [François Best](https://francoisbest.com)

Using this package at work ? [Sponsor me](https://github.com/sponsors/franky47) to help with support and maintenance.
