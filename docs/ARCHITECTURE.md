# Architecture

## Shared design

Each extension is an independent repository and VSIX. They share the same boundaries and developer command contract without introducing a cross-repository runtime dependency.

- `src/extension.ts` is the VS Code lifecycle entry point. It creates the controller and delegates shutdown.
- `src/controller.ts` owns commands, orchestration and activation-scoped state. VS Code resources are registered for disposal; asynchronous work is cancelled during shutdown.
- `src/config.ts` adapts VS Code settings to application configuration. Existing setting keys, command IDs and extension IDs are compatibility contracts.
- Domain modules implement the extension's specific behavior. UI adapters present results; transport/process adapters own external resources.
- Pure modules and adapters are tested without requiring a running Extension Host. CI packages the extension after static checks and tests.

## Module responsibilities

| Module | Responsibility |
| --- | --- |
| `extension.ts` | Activation and deactivation delegation. |
| `controller.ts` | Commands, configuration prompts and active generation ownership. |
| `config.ts` | Read and normalize the existing commit-genie settings. |
| `git.ts` | Repository selection and staged/working-tree diff collection. |
| `prompt.ts` | Conventional Commits instructions and user conventions. |
| `llm.ts` | Model discovery, streaming transport, cancellation and request timeout. |

## Lifecycle and data flow

Command → configuration → selected Git repository → diff → prompt → HTTP stream → SCM input box. A new generation aborts the previous generation. Cancellation is checked after asynchronous diff collection and before applying the final message. The HTTP timeout covers both headers and response consumption; abort listeners and stream readers are released. Model selection uses the same transport boundary.

## Compatibility and privacy

The publisher ID is `joygqz` and the source author is Quincy Zhang. Marketplace display names are account metadata. Changing the author must not alter extension IDs or user configuration namespaces.

Diffs are sent to the configured provider. API keys retain the existing settings-based behavior; no secret-storage migration is included in this refactor.

## Validation and release

`check-types`, `test`, `test:watch`, `verify`, `compile`, `build`, `check`, `package`, `ext:package` and `ext:publish` have the same meaning across repositories. `check` and `package` are aliases for the verified production build; VSIX creation uses `ext:package`. Existing bundlers and minimum VS Code versions remain extension-specific.

Release workflows must package verified source. Do not change a release version or publish a Marketplace update as part of a structural refactor without an intentional release.
