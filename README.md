<h1 align="center"><code>prisma-field-encryption</code></h1>

<div align="center">

[![NPM](https://img.shields.io/npm/v/prisma-field-encryption?color=red)](https://www.npmjs.com/package/prisma-field-encryption)
[![MIT License](https://img.shields.io/github/license/47ng/prisma-field-encryption.svg?color=blue)](https://github.com/47ng/prisma-field-encryption/blob/main/LICENSE)
[![Continuous Integration](https://github.com/47ng/prisma-field-encryption/workflows/Continuous%20Integration/badge.svg?branch=next)](https://github.com/47ng/prisma-field-encryption/actions)
[![Coverage Status](https://coveralls.io/repos/github/47ng/prisma-field-encryption/badge.svg?branch=next)](https://coveralls.io/github/47ng/prisma-field-encryption?branch=next)

</div>

<p align="center">Transparent field-level encryption at rest for Prisma.</p>

## Installation

Using your package manager of choice:

```shell
pnpm add prisma-field-encryption
yarn add prisma-field-encryption
npm install prisma-field-encryption
```

## Prisma version compatibility

This extension requires Prisma 4.7.0 or higher.

For Prisma versions 4.7.0 to 4.15.0, you will need to activate the
`clientExtensions` preview feature.

For Prisma versions 4.16.0, client extensions are generally available and don't
require a preview feature flag.

> **Note**: The previous middleware interface is still available for Prisma
> versions 3.8.0 to 4.6.x, but will be removed in a future update.
> It is recommended to update your Prisma client and use the extension mechanism,
> as support for middlewares will be removed from Prisma in the future.

## Usage

### 1. Extend your Prisma client

```ts
import { PrismaClient } from '@prisma/client'
import { fieldEncryptionExtension } from 'prisma-field-encryption'

const globalClient = new PrismaClient()

export const client = globalClient.$extends(
  // This is a function, don't forget to call it:
  fieldEncryptionExtension()
)
```

Read more about how to use [Prisma client extensions](https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions).

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
fieldEncryptionExtension({
  // Don't version hardcoded keys though, this is an example:
  encryptionKey: 'k1.aesgcm256.DbQoar8ZLuUsOHZNyrnjlskInHDYlzF3q6y1KGM7DUM='
})
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

> #### Note on @db.VarChar & field max lengths
>
> Encryption adds quite a bit of overhead, so you'll need to raise your database
> field maximum lengths (usually declared with `@db.VarChar(someNumber)` [or similar](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#string)).
>
> You can calculate the corresponding ciphertext length for a given clear-text length here:
> https://cloak.47ng.com/ciphertext-length-calculator

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

## Filtering using `where`

> _Support: introduced in version 1.4.0_

You cannot filter **directly** on encrypted fields:

```prisma
model User {
  id    String @id
  email String /// @encrypted
}
```

```ts
// This will return empty results:
prisma.user.findUnique({
  where: {
    email: 'blofeld@spectre.corp'
  }
})
```

This is because the encryption is not deterministic: encrypting the same input
multiple times will yield different outputs, due to the use of random initialisation
vectors to keep ciphertext safe. Therefore Prisma cannot match the query to the data.

For the same reason, indexes should not be placed on encrypted fields.

To circumvent this issue, the extension provides support for a separate field
containing a hash of the clear-text input, which is stable and can be used for
**exact** matching _(partial matching like `startsWith`, `contains` is not possible)_.

To use it, add a field next to your encrypted field with the following annotation:

```prisma
model User {
  id        String  @id
  email     String  @unique /// @encrypted
  emailHash String? @unique /// @encryption:hash(email) <- the name of the source field

  // Note that the @unique directive on `email` is here to enable
  // the Prisma user.findUnique({ where: { email }}) API,
  // and the @unique directive on `emailHash` is where you actually
  // ensure that there will be no duplicates.
  // The emailHash field is marked as nullable so you don't need to specify it
  // when creating records (it will be computed for you).
}
```

The annotation will automatically keep the `emailHash` field up to date when
creating or updating `email` values, and will allow the following:

```ts
// Now this works
prisma.user.findUnique({
  where: {
    email: 'james.bond@mi6.co.uk'
  }
})
```

Internally, the `where` clause will be rewritten to match the emailHash field
with the computed hash of the clear-text input (kind of like a password check).

### Hashing options

The default hash is a SHA-256 of the input interpreted as UTF-8,
with a hexadecimal output encoding (lowercase).

You can change those settings in the annotation, as follows:

```
/// @encryption:hash(email)?algorithm=sha512 <- anything supported by Node crypto.createHash
/// @encryption:hash(email)?inputEncoding=hex
/// @encryption:hash(email)?outputEncoding=base64

// Combine settings:
/// @encryption:hash(email)?algorithm=sha512&inputEncoding=base64&outputEncoding=base64
```

You can provide a salt to be appended after the input data, to protect from
rainbow table attacks. There are multiple ways to do so, listed by order of precedence:

1. Specify a salt directly in the Prisma schema:

```
/// @encryption:hash(email)?salt=0be97e77063ea3f7a0f128b06ef9b1ec
```

2. Specify the name of an environment variable where to read the salt:

```
/// @encryption:hash(email)?saltEnv=EMAIL_HASH_SALT
```

3. Use a global salt in the `PRISMA_FIELD_ENCRYPTION_HASH_SALT` environment variable that will apply to all hash fields.

The salt should be of the same encoding as the associated data to hash.

## Migrations

Adding encryption to an existing field is a transparent operation: Prisma will
encrypt data on new writes, and decrypt on read when data is encrypted, but
your existing data will remain in clear text.

Encrypting existing data should be done in a migration. The package comes with
a built-in automatic migration generator, in the form of a Prisma generator:

```prisma
generator client {
  provider        = "prisma-client-js"
}

generator fieldEncryptionMigrations {
  provider = "prisma-field-encryption"
  output   = "./where/you/want/your/migrations"
}
```

_Tip: the migrations generator makes use of the `interactiveTransactions` preview feature. Make sure it's enabled on your Prisma Client generator **only if Prisma Client version** is from `3.8.0 to 4.6.1`. Otherwise ignore this._

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

### Following migrations progress

A progress report is an object with the following fields:

- `model`: The model name
- `processed`: How many records have been processed
- `totalCount`: How many records were present at the start of the migration
- `performance`: How long it took to update the last record (in ms)

Note: because the totalCount is only computed once, additions or deletions
while a migration is running may cause the final processedCount to not equal
totalCount.

### Custom cursors

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

## Key management

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
fieldEncryptionExtension({
  decryptionKeys: [
    'k1.aesgcm256.DbQoar8ZLuUsOHZNyrnjlskInHDYlzF3q6y1KGM7DUM='
    // Add other keys here. Order does not matter.
  ]
})
```

_Tip: the current encryption key is already part of the decryption keys, no need to add it there._

Key rotation on existing fields (decrypt with old key and re-encrypt with the
new one) is done by [data migrations](#migrations).

## Custom Prisma client location

> _Support: introduced in version 1.4.0_

If you are generating your Prisma client to a custom location, you'll need to
tell the extension where to look for the DMMF _(the internal AST generated by Prisma that we use to read those triple-slash comments)_:

```ts
import { Prisma } from '../my/prisma/client'

prismaClient.$extends(
  fieldEncryptionExtension({
    dmmf: Prisma.dmmf
  })
)
```

## Encryption / decryption modes

> _Support: introduced in version 1.4.0_

For each field with an `/// @encrypted` annotation, you can specify two
extra modes of operation:

```prisma
model User {
  // Default mode behaves as follows:
  // -> data coming into the database is encrypted
  // <- data coming from the database is only decrypted if necessary
  //    (allow existing clear-text data to pass through)
  name String /// @encrypted

  // Strict mode:
  // -> data coming into the database is encrypted
  // <- data coming from the database is decrypted, and throws an error
  //    if decryption fails.
  // This mode can be useful once you've run your data migrations
  // and know that all data should be encrypted, or when you add
  // a new encrypted field to a model.
  ssn String /// @encrypted?mode=strict

  // Readonly mode:
  // -> data coming into the database is NOT encrypted
  // <- data coming from the database is only decrypted if necessary
  // This mode can be use to phase out encryption on a field that no longer
  // requires encryption. Before removing the @encrypted annotation,
  // run a data migration with this mode to decrypt all values for this
  // field in the database.
  noLongerSecret String /// @encrypted?mode=readonly
}
```

## Debugging

> _Support: introduced in version 1.4.0_

The extension uses [`debug`](https://www.npmjs.com/package/debug) to
print internal operations.

> _Note: it will log keys and clear-text data, so be mindful of your logs destination_.

The following namespaces are available:

- `prisma-field-encryption:setup`: Setup (encryption/decryption keys & schema analysis)
- `prisma-field-encryption:runtime`: Various generic runtime (per-query) info
- `prisma-field-encryption:encryption`: Encryption-specific operations (clear-text input, per-field information and encrypted input)
- `prisma-field-encryption:decryption`: Decryption-specific operations (raw data from the database, per-field information and decrypted result)
- `prisma-field-encryption:*`: Logs everything

Set the `DEBUG` environment variable to the namespaces you want to log:

```shell
# macOS/Unix:
$ DEBUG="prisma-field-encryption:*" npm run my-server-start-script

# Windows:
> set DEBUG=prisma-field-encryption:* & npm run my-server-start-script
```

> _Tip: you might want to set the `DEBUG_DEPTH` variable to control object printout depth._

## Caveats & limitations

### Field type

You can only encrypt `String` fields.

PRs are welcome to support more field types, see the following issues for reference:

- [#11](https://github.com/47ng/prisma-field-encryption/issues/11) for JSON fields
- [#26](https://github.com/47ng/prisma-field-encryption/issues/26) for Bytes fields

### `orderBy`

You cannot order by encrypted fields, even if they use a hash. While using a
hash would keep identical records together, the order of said records would not
match the expected order.

For this reason, ordering can only be done post-decryption, at runtime, in your
application code.

### Miscellaneous

[Raw database access](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)
operations are not supported.

Adding encryption adds overhead, both in storage space and in time to run queries,
though its impact hasn't been measured yet.

## How does this work ?

The extension reads the Prisma AST (DMMF) to find annotations (only triple-slash
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

Because of the transparent encryption provided by the extension, iterating over
records looks like a no-op (reading then updating with the same data), but this
will take care of:

- Encrypting fields newly `/// @encrypted`
- Rotating the encryption key when it changed
- Decrypting fields where encryption is being disabled with `/// @encrypted?mode=readonly`. Once that migration has run, you can remove the annotation on those fields.

## Do I need this ?

Some data is sensitive, and it's easy to give read access to the database to
a contractor or have backups end up somewhere they shouldn't be.

For those cases, encrypting the data per-field can make sense.

An example use-case is Two Factor authentication TOTP secrets: your app needs
them to authenticate your users, but nobody else should have access to them.

## Cryptography

Cipher used: AES-GCM with 256 bit keys.

## Disclaimers

The author cannot be made liable for any misuse of this software, as the
[MIT license](./LICENSE) states (the uppercase paragraph at the end).

That being said, a little SecOps common sense goes a long way:

## Passwords

🚨 **DO NOT USE THIS TO ENCRYPT PASSWORDS WITHOUT ADDITIONAL SECURITY MEASURES** 🚨

Passwords should be hashed & salted using a slow, constant-time one-way function. However, this library could be used to encrypt the salted and hashed password as a [pepper](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#peppering) to provide an additional layer of security. It is recommended that the encryption key be stored in a [Hardware Security Module](https://en.wikipedia.org/wiki/Hardware_security_module) on the server.

For hashing passwords, don't reinvent the wheel: use Argon2id if you can, otherwise scrypt.

## PCI-DSS

This software is **not** compliant with PCI-DSS standards. **DO NOT** use it to
encrypt credit card numbers or any other payment method information.

## Roadmap

- [x] Provide multiple decryption keys
- [x] Add facilities for migrations & key rotation
- [ ] v2 cryptographic design with AEAD - [RFC #54](https://github.com/47ng/prisma-field-encryption/issues/54)

## License

[MIT](./LICENSE) - Made with ❤️ by [François Best](https://francoisbest.com)

Using this package at work ? [Sponsor me](https://github.com/sponsors/franky47) to help with support and maintenance.
