# Contribution Guidelines

## Getting Started

1. Fork the repository & clone your fork
2. Install dependencies with `yarn install` _(uses Yarn v1)_
3. Build the sources with `yarn build`

## Running tests

1. Run `yarn test` to run all tests. This includes:

- Unit tests (`yarn test:unit`)
- Typechecking (`yarn test:types`)
- Integration tests (`yarn test:integration`)

The [integration test suite](./src/tests/integration.test.ts) runs against a local SQLite database.
It is copied from `./prisma/db.test.sqlite` to `./prisma/db.integration.sqlite` before each test runs.

The integration test suite runs twice:

- Once for the middleware API
- Once for the client extension API

## Contributing

First off, thanks a lot for your help!

### Commit messages

This package uses [semantic-release](https://semantic-release.gitbook.io/semantic-release) to manage versions.

Therefore, make sure your commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format.
There is a pre-commit hook in place that lints commit messages to ensure they follow the format.

### Pull requests

Please [open an issue](https://github.com/47ng/prisma-field-encryption/issues/new/choose) before submitting a pull request, so we can iterate
on the suggestion and solution.

If your pull request fixes an issue or adds a functionality, please add
a test case **at the end** of the [integration test suite](./src/tests/integration.test.ts). Each test runs in sequence, and shares the same database, so its state must be kept in mind.
