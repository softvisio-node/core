# Changelog

### v7.168.1 (2025-06-13)

**Fixes:**

- \[PATCH] fix: handle undfeined websocket protocol (● [5381d20](https://github.com/softvisio-node/core/commit/5381d20f6); 👬 zdm)

Compare with the previous release: [v7.168.0](https://github.com/softvisio-node/core/compare/v7.168.0...v7.168.1)

### v7.168.0 (2025-06-13)

**New features:**

- \[MINOR] feat: add postgresql nginx upstream port (● [590e45f](https://github.com/softvisio-node/core/commit/590e45f6f); 👬 zdm)

- \[MINOR] feat: increate nginx read timeout to 30 minutes (● [66d2fba](https://github.com/softvisio-node/core/commit/66d2fba05); 👬 zdm)

**Fixes:**

- \[PATCH] fix: fix http servers config schema (● [794df87](https://github.com/softvisio-node/core/commit/794df877a); 👬 zdm)

Compare with the previous release: [v7.167.2](https://github.com/softvisio-node/core/compare/v7.167.2...v7.168.0)

### v7.167.2 (2025-06-12)

**Fixes:**

- \[PATCH] fix: fix postgresql nginx config (● [3883359](https://github.com/softvisio-node/core/commit/388335972); 👬 zdm)

- \[PATCH] fix: fix postgresql nginx server name (● [1be84a6](https://github.com/softvisio-node/core/commit/1be84a651); 👬 zdm)

**Included pre-releases:**

- chore(release): release v7.167.2-rc.0 (● [b7e419e](https://github.com/softvisio-node/core/commit/b7e419e52); 👬 zdm)

Compare with the previous release: [v7.167.1](https://github.com/softvisio-node/core/compare/v7.167.1...v7.167.2)

### v7.167.2-rc.0 (2025-06-12)

**Fixes:**

- \[PATCH] fix: fix postgresql nginx server name (● [1be84a6](https://github.com/softvisio-node/core/commit/1be84a651); 👬 zdm)

**Refactoring:**

- \[PATCH] refactor: add debug log (● [0a75b40](https://github.com/softvisio-node/core/commit/0a75b40fb); 👬 zdm)

Compare with the previous release: [v7.167.1](https://github.com/softvisio-node/core/compare/v7.167.1...v7.167.2-rc.0)

### v7.167.1 (2025-06-12)

**Fixes:**

- \[PATCH] fix: fix postgresql component schema (● [6297ca7](https://github.com/softvisio-node/core/commit/6297ca717); 👬 zdm)

Compare with the previous release: [v7.167.0](https://github.com/softvisio-node/core/compare/v7.167.0...v7.167.1)

### v7.167.0 (2025-06-12)

**New features:**

- \[MINOR] feat: integrate postgresql nginx upstream (● [caf1dc0](https://github.com/softvisio-node/core/commit/caf1dc0de), [c2502d6](https://github.com/softvisio-node/core/commit/c2502d67e), [8957e47](https://github.com/softvisio-node/core/commit/8957e47f9); 👬 zdm)

Compare with the previous release: [v7.166.0](https://github.com/softvisio-node/core/compare/v7.166.0...v7.167.0)

### v7.166.0 (2025-06-12)

**New features:**

- \[MINOR] feat: add semantic version `isInitialVersion` property (● [36a36ee](https://github.com/softvisio-node/core/commit/36a36ee21); 👬 zdm)

**Fixes:**

- \[PATCH] fix: decrease websocket idle timeout for rpc to 40 seconds (● [e855c62](https://github.com/softvisio-node/core/commit/e855c628e); 👬 zdm)

- \[PATCH] fix: fix http dispatcher certificates check (● [2da7dbb](https://github.com/softvisio-node/core/commit/2da7dbb5a); 👬 zdm)

- \[PATCH] fix: update nginx api update id generation (● [5156f31](https://github.com/softvisio-node/core/commit/5156f3193); 👬 zdm)

**Refactoring:**

- \[PATCH] refactor: convert http size params from bytes to digital size in config (● [98a6c53](https://github.com/softvisio-node/core/commit/98a6c53dc); 👬 zdm)

- \[PATCH] refactor: tmp default tmp dir (● [ca1124c](https://github.com/softvisio-node/core/commit/ca1124c37); 👬 zdm)

**Other changes:**

- chore(style): fix typo (● [739f08b](https://github.com/softvisio-node/core/commit/739f08bf9); 👬 zdm)

Compare with the previous release: [v7.165.0](https://github.com/softvisio-node/core/compare/v7.165.0...v7.166.0)

### v7.165.0 (2025-06-11)

**New features:**

- \[MINOR] feat: add `defaultPreReleaseTag` option to the semantic version `increment()` (● [428dcdc](https://github.com/softvisio-node/core/commit/428dcdcae); 👬 zdm)

**Other changes:**

- chore(style): fix typo (● [0259b39](https://github.com/softvisio-node/core/commit/0259b394e); 👬 zdm)

Compare with the previous release: [v7.164.6](https://github.com/softvisio-node/core/compare/v7.164.6...v7.165.0)

### v7.164.6 (2025-06-11)

**Fixes:**

- \[PATCH] fix: fix git commit hash regexp (● aad323de2; 👬 zdm)

**Refactoring:**

- \[PATCH] refactor: update git changelog subject generator (● 5ed3c0bd4; 👬 zdm)

Compare with the previous release: [v7.164.5](https://github.com/softvisio-node/core/compare/v7.164.5...v7.164.6)

### v7.164.5 (2025-06-11)

**New features:**

- \[MINOR] feat: add commits to changelog entry (● 0a6c860d5; 👬 zdm)

- \[MINOR] feat: add linkify commits (● 9399414a0; 👬 zdm)

**Refactoring:**

- \[PATCH] refactor: rename ansi classs (● ac985a09d; 👬 zdm)

- \[PATCH] refactor: rename git api classes (● c7a861436; 👬 zdm)

Compare with the previous release: [v7.164.4](https://github.com/softvisio-node/core/compare/v7.164.4...v7.164.5)

### v7.164.4 (2025-06-10)

**Fixes:**

- \[PATCH] fix: re-throw SIGINT in utils confirm (👬 zdm)

Compare with the previous release: [v7.164.3](https://github.com/softvisio-node/core/compare/v7.164.3...v7.164.4)

### v7.164.3 (2025-06-09)

**Fixes:**

- \[PATCH] fix: update git build version format (👬 zdm)

Compare with the previous release: [v7.164.2](https://github.com/softvisio-node/core/compare/v7.164.2...v7.164.3)

### v7.164.2 (2025-06-09)

**Fixes:**

- \[PATCH] fix: fix nginx-upstream component destroy (👬 zdm)

**Other changes:**

- \[PATCH] chore: refactor app configure (👬 zdm)

Compare with the previous release: [v7.164.1](https://github.com/softvisio-node/core/compare/v7.164.1...v7.164.2)

### v7.164.1 (2025-06-09)

**Fixes:**

- \[PATCH] fix: fix http server configuration (👬 zdm)

Compare with the previous release: [v7.164.0](https://github.com/softvisio-node/core/compare/v7.164.0...v7.164.1)

### v7.164.0 (2025-06-09)

**Features:**

- \[MINOR] feat: add activity controller start / stop abort signals (👬 zdm)

- \[MINOR] feat: add build version (👬 zdm)

**Fixes:**

- \[PATCH] fix: fix docker image labels (👬 zdm)

**Other changes:**

- \[PATCH] chore: log docker build version (👬 zdm)

- \[PATCH] chore: refactor nginx api client (👬 zdm)

- \[PATCH] chore: set default server names for http servers (👬 zdm)

- \[PATCH] chore: set http servers nginx enabled by default (👬 zdm)

- \[PATCH] chore: use app service name in nginx upstream id (👬 zdm)

Compare with the previous release: [v7.163.0](https://github.com/softvisio-node/core/compare/v7.163.0...v7.164.0)

### v7.163.0 (2025-06-07)

**Features:**

- \[MINOR] feat: add websocket connection remote address (👬 zdm)

**Other changes:**

- \[PATCH] chore: add support for IpAddress to the nginx proxy upstreams (👬 zdm)

Compare with the previous release: [v7.162.0](https://github.com/softvisio-node/core/compare/v7.162.0...v7.163.0)

### v7.162.0 (2025-06-07)

**Features:**

- \[MINOR] feat: add nginx proxy upstreams set method (👬 zdm)

Compare with the previous release: [v7.161.1](https://github.com/softvisio-node/core/compare/v7.161.1...v7.162.0)

### v7.161.1 (2025-06-07)

**Other changes:**

- \[PATCH] chore: fix git id (👬 zdm)

- \[PATCH] chore: update nginx-upstream component (👬 zdm)

Compare with the previous release: [v7.161.0](https://github.com/softvisio-node/core/compare/v7.161.0...v7.161.1)

### v7.161.0 (2025-06-07)

**Features:**

- \[MINOR] feat: add ajv timestamp format (👬 zdm)

- \[MINOR] feat: add nginx-upstream component (👬 zdm)

**Other changes:**

- \[PATCH] chore: refactor docker builder (👬 zdm)

- \[PATCH] chore: refactor git branch status (👬 zdm)

- \[PATCH] chore: refactor git working tree status (👬 zdm)

- \[PATCH] chore: update api schema (👬 zdm)

- \[PATCH] chore: update cli config (👬 zdm)

- \[PATCH] chore: update status when commit not found (👬 zdm)

Compare with the previous release: [v7.160.4](https://github.com/softvisio-node/core/compare/v7.160.4...v7.161.0)

### v7.160.4 (2025-06-03)

**Fixes:**

- \[PATCH] fix: fix cyclic dependency (👬 zdm)

Compare with the previous release: [v7.160.3](https://github.com/softvisio-node/core/compare/v7.160.3...v7.160.4)

### v7.160.3 (2025-06-03)

**Other changes:**

- \[PATCH] chore: update components deps (👬 zdm)

- \[PATCH] chore: update nginx config builder (👬 zdm)

Compare with the previous release: [v7.160.2](https://github.com/softvisio-node/core/compare/v7.160.2...v7.160.3)

### v7.160.2 (2025-06-03)

**Fixes:**

- \[PATCH] fix: fix nginx integration (👬 zdm)

Compare with the previous release: [v7.160.1](https://github.com/softvisio-node/core/compare/v7.160.1...v7.160.2)

### v7.160.1 (2025-06-03)

**Other changes:**

- \[PATCH] chore: refactor app cluster component (👬 zdm)

Compare with the previous release: [v7.160.0](https://github.com/softvisio-node/core/compare/v7.160.0...v7.160.1)

### v7.160.0 (2025-06-03)

**Features:**

- \[MINOR] feat: add app env component (👬 zdm)

**Other changes:**

- \[PATCH] chore: refactor nginx integration (👬 zdm)

Compare with the previous release: [v7.159.1](https://github.com/softvisio-node/core/compare/v7.159.1...v7.160.0)

### v7.159.1 (2025-06-02)

**Fixes:**

- \[PATCH] fix: fix docker builder clone ordeer (👬 zdm)

Compare with the previous release: [v7.159.0](https://github.com/softvisio-node/core/compare/v7.159.0...v7.159.1)

### v7.159.0 (2025-06-02)

**Features:**

- \[MINOR] feat: add nginx support to private http server (👬 zdm)

**Other changes:**

- \[PATCH] chore: update compose schema (👬 zdm)

Compare with the previous release: [v7.158.7](https://github.com/softvisio-node/core/compare/v7.158.7...v7.159.0)

### v7.158.7 (2025-06-02)

**Other changes:**

- \[PATCH] chore: update compose schema (👬 zdm)

Compare with the previous release: [v7.158.6](https://github.com/softvisio-node/core/compare/v7.158.6...v7.158.7)

### v7.158.6 (2025-06-01)

**Other changes:**

- \[PATCH] chore: update docs (👬 zdm)

Compare with the previous release: [v7.158.5](https://github.com/softvisio-node/core/compare/v7.158.5...v7.158.6)

### v7.158.5 (2025-06-01)

**Other changes:**

- \[PATCH] chore: change markdown links to text format (👬 zdm)

Compare with the previous release: [v7.158.4](https://github.com/softvisio-node/core/compare/v7.158.4...v7.158.5)

### v7.158.4 (2025-06-01)

**Other changes:**

- \[PATCH] chore: clone repo after confirmation in docker builder (👬 zdm)

Compare with the previous release: [`v7.158.3...v7.158.4`](https://github.com/softvisio-node/core/compare/v7.158.3...v7.158.4)

### v7.158.3 (2025-06-01)

**Other changes:**

- \[PATCH] chore: refactor git api (👬 zdm)

- \[PATCH] chore: update docker builder options (👬 zdm)

Compare with the previous release: [`v7.158.2...v7.158.3`](https://github.com/softvisio-node/core/compare/v7.158.2...v7.158.3)

### v7.158.2 (2025-06-01)

**Fixes:**

- \[PATCH] fix: fix docker builder clone conditions (👬 zdm)

Compare with the previous release: [`v7.158.1...v7.158.2`](https://github.com/softvisio-node/core/compare/v7.158.1...v7.158.2)

### v7.158.1 (2025-06-01)

**Other changes:**

- \[PATCH] chore: minor code refactoring (👬 zdm)

Compare with the previous release: [`v7.158.0...v7.158.1`](https://github.com/softvisio-node/core/compare/v7.158.0...v7.158.1)

### v7.158.0 (2025-05-31)

**Features:**

- \[MINOR] feat: add threads terminateThread method (👬 zdm)

**Fixes:**

- \[PATCH] fix: fix docker builder (👬 zdm)

- \[PATCH] fix: fix whisper api (👬 zdm)

**Other changes:**

- \[PATCH] chore: refactor git api (👬 zdm)

- \[PATCH] chore: refactor git id (👬 zdm)

Compare with the previous release: [`v7.157.1...v7.158.0`](https://github.com/softvisio-node/core/compare/v7.157.1...v7.158.0)

### v7.157.1 (2025-05-31)

**Fixes:**

- \[PATCH] fix: ignore merge commits in git changes (👬 zdm)

Compare with the previous release: [`v7.157.0...v7.157.1`](https://github.com/softvisio-node/core/compare/v7.157.0...v7.157.1)

### v7.157.0 (2025-05-31)

**Features:**

- \[MINOR] feat: add git getUpstream method (👬 zdm)

- \[MINOR] feat: add repository slug option to the upstream linkify message (👬 zdm)

**Other changes:**

- \[PATCH] chore: add devel domains to the certificates resource (👬 zdm)

- \[PATCH] chore: refactor git upstream (👬 zdm)

- \[PATCH] chore: rename linkifyMessage to linkifyText (👬 zdm)

Compare with the previous release: [`v7.156.0...v7.157.0`](https://github.com/softvisio-node/core/compare/v7.156.0...v7.157.0)

### v7.156.0 (2025-05-30)

**Features:**

- \[MINOR] feat: add Locale.languageisValid method (👬 zdm)

- \[MINOR] feat: add whisper api detect language (👬 zdm)

**Fixes:**

- \[PATCH] fix: do not ignore merge commits in changes (👬 zdm)

- \[PATCH] fix: fix git find previous release (👬 zdm)

**Other changes:**

- \[PATCH] chore: improve code (👬 zdm)

- \[PATCH] chore: refactor git api (👬 zdm)

- \[PATCH] chore: refactor git changes (👬 zdm)

### v7.155.0 (2025-05-28)

**Features:**

- \[MINOR] feat: add git commit isBranchHead property (👬 zdm)

### v7.154.0 (2025-05-28)

**Features:**

- \[MINOR] feat: add ajv semver format (👬 zdm)

- \[MINOR] feat: add commit options to the git.getCurrentRelease method (👬 zdm)

- \[MINOR] feat: refactor git api (👬 zdm)

**Other changes:**

- \[PATCH] chore: add Semver inspector handler (👬 zdm)

- \[PATCH] chore: cleanup code (👬 zdm)

- \[PATCH] chore: refactor semantic version (👬 zdm)

- \[PATCH] chore: refactor semantic-version (👬 zdm)

- \[PATCH] chore: rename params field name in api (👬 zdm)

- \[PATCH] chore: update whisper api (👬 zdm)
