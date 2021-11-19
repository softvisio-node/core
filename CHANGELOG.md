# Changelog

### 6.22.0 (2021-11-19)

Features:

-   feat: api read keyword enum
-   feat: app terminate hook

Fixes:

-   fix: api read
-   fix: mime type check

### 6.21.0 (2021-11-19)

Features:

-   feat: api object after delete trigger

Fixes:

-   fix: docker engine api prune methods added

### 6.20.0 (2021-11-18)

Features:

-   feat: app init refactored
-   feat: app settings renamed to const
-   feat: read next_page property

Fixes:

-   fix: file type

### 6.19.2 (2021-11-14)

Fixes:

-   fix: api profile/read removed
-   fix: api read conditions
-   fix: api token refactored

### 6.19.1 (2021-11-13)

Fixes:

-   fix: avj read macro

### 6.19.0 (2021-11-13)

Features:

-   feat: api read keyword refactored
-   feat: api read maxResults
-   feat: api schema file keyword
-   feat: api users/suggest removed
-   feat: app settings
-   feat: sql OFFSET_LIMIT

Fixes:

-   fix: api methods renamed
-   fix: fetch compat
-   fix: fetch crome user agent string updated
-   fix: read total from summary only
-   fix: sql undefined where condition

### 6.18.0 (2021-11-08)

Features:

-   feat: signup + signin if new user enabled

### 6.17.0 (2021-11-08)

Features:

-   feat: db schema index.yaml

Fixes:

-   fix: api schema files renamed

### 6.16.0 (2021-11-07)

Features:

-   feat: docker registry image delete method
-   feat: dockerhub api
-   feat: object roles

### 6.15.0 (2021-11-06)

Features:

-   feat: json stream

Fixes:

-   fix: docker registry auth cache

### 6.14.0 (2021-11-05)

Features:

-   feat: docker engine api
-   feat: docker registry api
-   feat: http headers parser refactored

Fixes:

-   fix: app api,rpc singletones
-   fix: notification profile conditions

### 6.13.5 (2021-11-02)

Fixes:

-   fix: telegram username cache

### 6.13.4 (2021-11-02)

Fixes:

-   fix: primary key

### 6.13.3 (2021-11-01)

Fixes:

-   fix: security notifications

### 6.13.2 (2021-11-01)

Fixes:

-   fix: browser uuid v4
-   fix: security notifications
-   fix: telegram message

### 6.13.1 (2021-11-01)

Fixes:

-   fix: browser uuid v4

### 6.13.0 (2021-11-01)

Features:

-   feat: app settings
-   feat: notifications api
-   feat: notifications settings
-   feat: notifications types
-   feat: postgres json notifications
-   feat: root telegram username
-   feat: sql emits property
-   feat: telegram bot api
-   feat: telegram_name renamed to telegram_username

Fixes:

-   fix: api db events
-   fix: db notification -> internal_notification
-   fix: notifications config
-   fix: sendNotification -> sendInternalNotification

### 6.12.1 (2021-10-30)

Fixes:

-   fix: api int53
-   fix: PgSql renamed to Pgsql

### 6.12.0 (2021-10-30)

Features:

-   feat: sql int53 type

Fixes:

-   fix: sasl

### 6.11.1 (2021-10-29)

No notable changes since the previous release.

### 6.11.0 (2021-10-29)

Features:

-   feat: postgres sasl

### 6.10.1 (2021-10-29)

Fixes:

-   fix: api db patch updated

### 6.10.0 (2021-10-29)

Features:

-   feat: timescaledb removed

### 6.9.4 (2021-10-26)

No notable changes since the previous release.

### 6.9.3 (2021-10-23)

Fixes:

-   fix: pgsql types

### 6.9.2 (2021-10-23)

Fixes:

-   fix: auth cache prune
-   fix: smtp body
-   fix: smtp from
-   fix: smtp threads limit

### 6.9.1 (2021-10-22)

Fixes:

-   fix: app read mixin total
-   fix: result.try allowUndefined false by default
-   fix: sql query to string
-   fix: sqlite lock() removed

### 6.9.0 (2021-10-17)

Features:

-   feat: read / unread notifications

### 6.8.0 (2021-10-16)

Features:

-   feat: lru cache delete returns deletet entry

Fixes:

-   fix: invalidate on password change
-   fix: token generator

### 6.7.0 (2021-10-15)

Features:

-   feat: notifications done property
-   feat: notifications refactored

Fixes:

-   fix: fetch Agent

### 6.6.0 (2021-10-12)

Features:

-   feat: api method binaryProtocolRequired property
-   feat: cloudflare api

### 6.5.0 (2021-10-11)

Features:

-   feat: kebabToCamelCase function

Fixes:

-   fix: app perms kebab case
-   fix: handle for invalid patterns in tests
-   fix: send notifications methods renamed
-   fix: snake case re
-   fix: uule lib moved

### 6.4.0 (2021-10-09)

Features:

-   feat: api isApi, isRpc properties
-   feat: app client api property
-   feat: app client isBinary property
-   feat: arbitrary RPC events
-   feat: utils naming conventions module

### 6.3.0 (2021-10-08)

Features:

-   feat: app connection object
-   feat: core cluster

### 6.2.0 (2021-10-07)

Features:

-   feat: semaphore set delete method added

### 6.1.0 (2021-10-07)

Features:

-   feat: utils.resolve() option url

Fixes:

-   fix: sql trigger name

### 6.0.0 (2021-10-06)

No notable changes since the previous release.

Migration:

-   All identifiers renamed to the strict camelCase, without consecutive capital letters.
-   API methods renamed to camelCase, `API_methodName`.
-   Threads call must use camelCase notation for method, `threads.call( threadName, "methodName" )`.

### 6.0.0-alpha.6 (2021-10-06)

Fixes:

-   fix: invalidate user token
-   fix: validate api read params

Migration:

### 6.0.0-alpha.5 (2021-10-06)

Features:

-   feat: sql query toString()

Fixes:

-   fix: api schema casel case reverted
-   fix: auth user id serialization
-   fix: db camel case reverted
-   fix: orderBy reverted
-   fix: snake_case validation

Migration:

### 6.0.0-alpha.4 (2021-10-05)

Breaking changes:

-   feat!: strict camel case

Migration:

### 6.0.0-alpha.3 (2021-10-04)

Breaking changes:

-   feat!: strict camel case

Migration:

### 6.0.0-alpha.2 (2021-10-04)

Breaking changes:

-   feat!: strict camel case

Migration:

### 6.0.0-alpha.1 (2021-10-04)

Breaking changes:

-   feat!: api methods and params names are in strict camelCase
-   feat!: strict camel case
-   feat!: threads rpc methods must be in camelCase

Migration:

-   API methods and params names must be in the camelCase.

### 6.0.0-alpha.0 (2021-10-04)

Breaking changes:

-   feat!: strict camel case

Features:

-   feat: api context isWebSocket replaced with connectionId
-   feat: api persistent connection id
-   feat: API presistent connection check for method
-   feat: app api client connect/disconnect events
-   feat: app isClientConnected() method
-   feat: mutex set has() method added
-   feat: semaphore id

Fixes:

-   fix: mutex set id
-   fix: semaphore signal lazy creation

Migration:

-   All identifiers renamed to the strict camelCase, without consecutive capital letters.

### 5.2.2 (2021-09-30)

Fixes:

-   fix: serialize non-string env values to json

### 5.2.1 (2021-09-30)

Fixes:

-   fix: env readConfig options update

### 5.2.0 (2021-09-27)

Features:

-   feat: sql meta module

Fixes:

-   fix: sqlite migrate throw error if patch function is async

### 5.1.0 (2021-09-26)

Features:

-   feat: db schema type

Fixes:

-   fix: make sqlite fully sync

### 5.0.1 (2021-09-25)

Fixes:

-   fix: fetch lazy load http agent

### 5.0.0 (2021-09-24)

Fixes:

-   fix: meta property

Migration:

-   Result meta property.

### 5.0.0-alpha.0 (2021-09-24)

Breaking changes:

-   feat!: meta property

Features:

-   feat: nenv script

Fixes:

-   fix: isSqlite, isPgsql props renamed
-   fix: make sqlite calls async
-   fix: sql release lockec dbh
-   fix: sql release locked dbh
-   fix: sqlite busy timout 30 sec

Migration:

-   Result meta property.

### 4.32.0 (2021-09-22)

Features:

-   feat: notifications mark unread
-   feat: publish notifications from the app thread
-   feat: publish to the other cluster namespace

Fixes:

-   fix: app sendMail method moved to notifications.sendEmail
-   fix: app thread services moved to the app property (minor breaking change)
-   fix: sqlite lastInsertRowId removed

### 4.31.0 (2021-09-19)

Features:

-   feat: google apis

### 4.30.1 (2021-09-19)

Fixes:

-   fix: app cluster pub/sub
-   fix: uuid repalced with crypto randomUUID

### 4.30.0 (2021-09-19)

Features:

-   feat: api profile delete sessions
-   feat: notifications api
-   feat: utils relativeTime function

### 4.29.0 (2021-09-17)

Features:

-   feat: api drop user sessions
-   feat: drop user sessions on user disabled
-   feat: uws end() closeConnection parameter added

Fixes:

-   fix: docker devel tag removed

### 4.28.7 (2021-09-12)

Fixes:

-   fix: browser env
-   fix: docker autobuild_tags renamed to auto_tags

### 4.28.6 (2021-09-08)

Fixes:

-   fix(proxy): boolean params serialization

### 4.28.5 (2021-09-08)

Fixes:

-   fix(proxy): resolve option
-   fix(proxy): softvisio params separator

### 4.28.4 (2021-09-07)

Fixes:

-   fix: docker autobuild tags

### 4.28.3 (2021-09-06)

Fixes:

-   fix(hostname): resources etag

### 4.28.2 (2021-09-04)

Fixes:

-   fix: build datasets github action

### 4.28.1 (2021-09-03)

Fixes:

-   fix: dockerfile cleanup

### 4.28.0 (2021-09-02)

Features:

-   feat: core resources datasets
-   feat: node-fetch v3

### 4.27.2 (2021-08-30)

Fixed:

-   default hostname resources update interval fixed

### 4.27.1 (2021-08-30)

Fixed:

-   default resources update interval fixed

### 4.27.0 (2021-08-30)

Changed:

-   docker image moved to softvisio/node

### 4.26.0 (2021-08-30)

Added:

-   docs updated
-   hostname module added

Fixed:

-   method signature fixed

### 4.25.4 (2021-08-30)

Fixed:

-   unref resources update timeout

### 4.25.3 (2021-08-30)

Fixed:

-   resources updater refactored

### 4.25.2 (2021-08-30)

Fixed:

-   benchmarks relative speed format updated

### 4.25.1 (2021-08-29)

Fixed:

-   resources updater

### 4.25.0 (2021-08-29)

Added:

-   resources updater
-   export tar

### 4.24.1 (2021-08-26)

Fixed:

-   github api imports fixed

### 4.24.0 (2021-08-26)

Added:

-   github api added

### 4.23.0 (2021-08-25)

Added:

-   api/hub renamed to api/services
-   semaphore set refactored
-   docs updated

### 4.22.10 (2021-08-23)

Fixed:

-   api object user id type fixed
-   db patches renamed

### 4.22.9 (2021-08-20)

Fixed:

-   sql patch version parser fixed
-   docs updated

### 4.22.8 (2021-08-19)

Fixed:

-   sql transactions fixed
-   sql migrate apply patches in own transactions
-   sql dbh lock added
-   pgsql notice fixed

### 4.22.7 (2021-08-16)

Fixed:

-   sql migration refactored
-   sql tagged param fixed
-   sql query refactored
-   make sqlite methods synchronous

### 4.22.6 (2021-08-15)

Fixed:

-   sql sqlite.db property renamed to .sqlite

### 4.22.5 (2021-08-14)

Fixed:

-   sql return error on invalid decode type

### 4.22.4 (2021-08-14)

Fixed:

-   sql types refactored

### 4.22.3 (2021-08-14)

Fixed:

-   docs updated
-   sql refactored
-   sqlite boolean type fixed

### 4.22.2 (2021-08-11)

Fixed:

-   fileurl parser fixed

### 4.22.1 (2021-08-11)

Fixed:

-   threads path parser fixed

### 4.22.0 (2021-08-08)

Added:

-   docs updated
-   text wrap refactored

Removed:

-   ansi getCodes() method removed

Fixed:

-   api http body read fixed
-   stream.buffer() returns emptry buffer
-   ansi codes regexp updated to match the specification
-   get random item by weight refactored

### 4.21.5 (2021-08-05)

Fixed:

-   ip range prefix option added to the constructor
-   ip tests added

### 4.21.4 (2021-08-04)

Fixed:

-   ip more caches added
-   typo fixed

### 4.21.3 (2021-08-04)

Fixed:

-   ip prev / next addr cache added

### 4.21.2 (2021-08-04)

Fixed:

-   ip v6 to string fixed
-   ip cidr mask fixed

### 4.21.1 (2021-08-04)

Fixed:

-   ip constructor updated

### 4.21.0 (2021-08-04)

Changed:

-   ip refactored

### 4.20.2 (2021-08-03)

Fixed:

-   app db schema migration fixed

### 4.20.1 (2021-08-03)

Fixed:

-   app class renamed

### 4.20.0 (2021-08-03)

Added:

-   merged with app

### 4.19.2 (2021-08-02)

Fixed:

-   table coerce null values to empty strings

### 4.19.1 (2021-08-01)

Fixed:

-   export deps
-   docs updated
-   http request stream import updated

### 4.19.0 (2021-07-31)

Changed:

-   http/utils -> utils/http
-   browser const removed
-   google uule moved to core

### 4.18.5 (2021-07-31)

Fixed:

-   apis moved to own package

### 4.18.4 (2021-07-31)

Fixed:

-   imports fixed

### 4.18.3 (2021-07-31)

Fixed:

-   deps fixed

### 4.18.2 (2021-07-31)

Fixed:

-   deps fixed

### 4.18.1 (2021-07-31)

Fixed:

-   merged with config and env

### 4.18.0 (2021-07-31)

Added:

-   merged with utils

### 4.17.1 (2021-07-31)

Fixed:

-   app ajv keywords moved to the app packages

### 4.17.0 (2021-07-31)

Changed:

-   docs updated
-   app moved to the own package

### 4.16.6 (2021-07-30)

Fixed:

-   api profile set-password spec added

### 4.16.5 (2021-07-29)

Fixed:

-   websockets statuses updated

### 4.16.4 (2021-07-29)

Fixed:

-   websockets statuses updated

### 4.16.3 (2021-07-29)

Fixed:

-   api websockets fast disconnect
-   ws v8.0.0

### 4.16.2 (2021-07-29)

Changed:

Fixed:

-   docs updated
-   docs types updated
-   config export updated

### 4.16.1 (2021-07-28)

Fixed:

-   utils.resolve() moved to utils package

### 4.16.0 (2021-07-28)

Changed:

-   fs.config moved to the config
-   fs.resolve moved to the utils.resolve
-   fs.FileTree moved to the file-tree
-   fs.getHash() removed
-   fs.tmp moveed to tmp
-   stream code improved
-   mime code improved

### 4.15.0 (2021-07-28)

Changed:

Added:

-   stream readers updated
-   docs updated
-   filetree resolve path on write
-   blob refactored
-   stream.Readable.blackhole() added
-   api upload abort signal fixed
-   file drop type on name set
-   TmpFile constructor options changed
-   stream.Readable.buffer() added
-   stream.Readable.tmpFile() added
-   file setters added
-   TmpFile extends File interface

Removed:

-   http request bodyUsed removed

Fixed:

-   file get type fixed
-   stream exports fixed

### 4.14.0 (2021-07-26)

Changed:

Added:

-   form data decoder refactored
-   split stream completed feature added

### 4.13.2 (2021-07-25)

Fixed:

-   docs updated

### 4.13.1 (2021-07-25)

Fixed:

-   cache option event added
-   cache max -> maxSize

### 4.13.0 (2021-07-25)

Changed:

-   cache-lru changed to own implementation

### 4.12.3 (2021-07-22)

Fixed:

-   docs generator fixed
-   env export fixed

### 4.12.2 (2021-07-21)

Fixed:

-   deps cleaned

### 4.12.1 (2021-07-21)

Fixed:

-   mime config import fixed

### 4.12.0 (2021-07-21)

Added:

-   read configs using @softvisio/config

### 4.11.0 (2021-07-21)

Changed:

-   env moved to own @softvisio/env package

### 4.10.1 (2021-07-21)

Fixed:

-   api user tokens reader fixed

### 4.10.0 (2021-07-20)

Changed:

-   form-data refactored
-   stream comined added
-   mime refactored
-   stream.writeToTmpFile() method added
-   stream.slurp() renamed to stream.writeToBuffer()
-   fs.tmp refactored
-   http request stream fixed
-   stream.readLine fixed
-   api upload methos make uploadMaxSize parameter mandatory
-   api schema param desc generator support typeof, instanceof keywords added
-   Ajv.registerInstance() method added

### 4.9.0 (2021-07-16)

Changed:

-   utils moved to @softvisio/utils

### 4.8.1 (2021-07-15)

Removed:

-   api context version option removed

### 4.8.0 (2021-07-15)

Changed:

-   api schema refactored

### 4.7.0 (2021-07-15)

Added:

-   api schema params description builder improved
-   ajv constructor refactored

### 4.6.1 (2021-07-15)

Fixed:

-   api schema param description refactored
-   docs updated

### 4.6.0 (2021-07-14)

Added:

-   docs externalTypes option added
-   api schema docs method signature updated
-   api params valitation error messages added

### 4.5.9 (2021-07-11)

Fixed:

-   typo fixed

### 4.5.8 (2021-07-11)

Fixed:

-   api client normalize url

### 4.5.7 (2021-07-11)

Fixed:

-   api schema template fixed

### 4.5.6 (2021-07-11)

Fixed:

-   api schema template fixed

### 4.5.5 (2021-07-11)

Fixed:

-   docs generator api url fixed

### 4.5.4 (2021-07-11)

Fixed:

-   api http get params from searchParams removed
-   api http url compose fixed
-   api schema generator options updated

### 4.5.3 (2021-07-11)

Fixed:

-   api schema generator updated

### 4.5.2 (2021-07-10)

Fixed:

-   app config settings moved to env
-   env convert variables to string when applying from the config

### 4.5.1 (2021-07-09)

Fixed:

-   env xdg locations for windows updated

### 4.5.0 (2021-07-08)

Added:

-   sqlite attach support for file: urls added

### 4.4.0 (2021-07-07)

Added:

-   api protocl cache-contron options added
-   api hub addServicesfromEnv() include/exclude options added

### 4.3.0 (2021-07-07)

Removed:

-   app settings feature removed

### 4.2.0 (2021-07-06)

Added:

-   env xdg support added
-   github pages api added

### 4.1.6 (2021-07-05)

Fixed:

-   URL default port fixed

### 4.1.5 (2021-07-05)

Fixed:

-   sql options refactored

### 4.1.4 (2021-07-04)

Fixed:

-   docs updated
-   proxy pool build url fixed
-   proxy sort url params
-   api client refactored
-   api client toString, toJSON methods added
-   api /jsonrpc endpoint removed
-   api websockets auth invalidate listener cleanup
-   proxy classes renamed

### 4.1.3 (2021-06-30)

Fixed:

-   api client wss connection fixed for multiple connections
-   api ws protocol changed to jsonrpc 2.0
-   error message fixed

### 4.1.2 (2021-06-29)

Fixed:

-   api hub callCached method added
-   api schema generator make JSON schema collapsible
-   deps updated
-   docs updated

### 4.1.1 (2021-06-28)

Fixed:

-   FileTree.write() fixed
-   docs updated

### 4.1.0 (2021-06-28)

Added:

-   api client static new() added
-   api client url cache options added

Fixed:

-   docs updated

### 4.0.4 (2021-06-28)

Fixed:

-   schema docs toc removed

### 4.0.3 (2021-06-26)

Fixed:

-   cli help fixed

### 4.0.2 (2021-06-25)

Fixed:

-   schema generator types fixed;

### 4.0.1 (2021-06-25)

Fixed:

-   schema generator types fixed;
-   docs updated;

### 4.0.0 (2021-06-24)

Changed:

-   cli commands refactored;
-   docs updated;
-   table refactored;

Added:

-   table defineStyle added;

### 4.0.0-beta.4 (2021-06-22)

Empty release

### 4.0.0-beta.3 (2021-06-22)

Fixed:

-   cli arguments help updated;
-   typo fixed;

### 4.0.0-beta.2 (2021-06-22)

Changed:

-   api events publishing refactored;

### 4.0.0-beta.1 (2021-06-22)

Changed:

-   sql.connect -> sql.new;
-   app .settings -> await app.getSettings();
-   dbh.isConnected -> dbh.isReady;
-   api backend events renamed;
-   app cluster refactored;
-   sql events refactored;
-   app refactored;
-   threads refactored;
-   app api / rpc init code changed;
-   http server class refactored;
-   api protocol updated;
-   rpc response code updated;

Added:

-   private api methods added;
-   http server emits listening events;
-   threads subscribe / unsubsribe feature added;

Removed:

-   eventsemitter3 removed;

Fixed:

-   bench displays relative speed in percent;
-   table don't convert null values to empty string;
-   cli help updated;

### 4.0.0-beta.0 (2021-06-14)

Added:

-   api call context more options added;

### 4.0.0-alpha.1 (2021-06-14)

Changed:

-   cli schema changed, arrays support added;

### 4.0.0-alpha.0 (2021-06-13)

Changed:

-   result updated to v4;
-   external api protocol changed to JSON-RPC 2.0;
-   eventNamePrefix option removed;
-   sql selectAll() method renamed to select();
-   api schema updated;

Added:

-   fetch body Blob support added;
-   cli short commands name support added;
-   api schema params names snake_case check added;
-   github api added;

Removed:

-   api schema `summary` property removed;

Fixed:

-   cli commands refactored;

### 3.13.1 (2021-06-05)

Changed:

-   moved to github;

### 3.13.0 (2021-06-05)

Changed:

-   assets -> resources;
-   resources -> assets;
-   api curl template updated;
-   app loadAPI method added;
-   File text() method added;
-   docs generator updated;
-   result try/catch/parse methods renamed;
-   docs updated;
-   tmpl -> templates;

### 3.12.0 (2021-06-03)

Changed:

-   docs config;
-   api shema geenrator options added;
-   api templates updated;
-   moved to github;
-   docs updated;
-   docs code block tags added;

### 3.11.0 (2021-06-01)

Changed:

-   api proto refactored;
-   api schema moved to the external files;
-   doc module removed;
-   api schema moved to the exteranl files;
-   ansi.wrap added;
-   ansi styles updated;
-   typo fixed;
-   ansi methods renamed;
-   cli arrays support added;
-   app authentication fixed;
-   do not sort tests;
-   tests report updated;
-   cli short option parser improved;

### 3.10.0 (2021-05-29)

Changed:

-   app authentication fixed;
-   test refactored;
-   cli arguments parser improved;
-   perl 5.34;
-   tests updated;
-   ansi refactored;
-   tests watch added;
-   tests refactored;
-   ansi 24bit colors;
-   tests disabled benchmarks;
-   app api context;
-   api client signout event added;
-   auth avatar added;
-   rpc permissions must be specified;
-   tests number format added;
-   app api check method version on call;
-   app rpc pass auth as first param on call;
-   big-integer deps removed;
-   read mime-db.json instead of import;
-   api client emits close after all clients disconnected;
-   subnets updated;
-   app mixing updated;

### 3.9.0 (2021-05-19)

Changed:

-   mime moved to /;
-   subnets moved to ip/;

### 3.8.0 (2021-05-19)

Changed:

-   databases moved to own package;
-   api bench removed;
-   noParamsValidation -> validateParams;
-   api schema class added;
-   api stat prop moved;
-   api callCached method added;
-   fs config write support for file urls added;
-   lint script removed;
-   sync tests fixed;
-   api rpc params validation;
-   sqlite support for file urls added;
-   google uule api changed;
-   sqlite fix;
-   typo;
-   bench merged with tests;
-   ansi import updated;
-   api websocket isConnected -> isOpen;
-   api getConnection persistent check;

### 3.7.0 (2021-05-18)

Changed:

-   api multihost;
-   api protocol auth message removed;
-   cli \_findSpec method added;
-   app rpc public methods removed;
-   pgsql max option -> maxConnections;

### 3.6.1 (2021-05-17)

Changed:

-   stream read http headers fixed;

### 3.6.0 (2021-05-17)

Changed:

-   stream readLine fixed;
-   cli refactored;
-   rpc methods permissions not required;
-   threads RPC* prefix changed to API*;
-   api rpc added;
-   app rpc default port 8080;
-   cli special argument --;
-   minor code improvements;
-   stream readChunk updated;
-   cluster api service;
-   stream readLine refactored;
-   jest tests added;
-   jest integrated;
-   test environment added;

### 3.5.2 (2021-05-13)

Changed:

-   browser env set mode fixed;

### 3.5.1 (2021-05-13)

Changed:

-   exports fixed;

### 3.5.0 (2021-05-13)

Changed:

-   api http statusText;
-   file api refactored;
-   env mode accessors added;
-   more browser objects added;
-   fetch reason getter added;
-   classes moved to #browser;
-   classes moved to #internals;
-   upload mixin removed;
-   fetch response patched;
-   utls/env moved to env;
-   env read -> readConfig;
-   env read -> readConfigs;
-   env getBool -> readBoolValue;
-   file tree use file object;
-   api uploads refactored;
-   api client refactored;
-   blob added;
-   filetree isempty property;
-   use node-fetch.mjs;
-   server request body methods added;

### 3.4.0 (2021-05-11)

Changed:

-   http server req writeStatus -> writeHead;
-   typo;
-   imports updated;
-   http server request writeeaders fixed;
-   http server req body methods added;
-   http server req stream added;

### 3.3.1 (2021-05-09)

Changed:

-   http server request fixed;

### 3.3.0 (2021-05-09)

Changed:

-   http server request refactored;

### 3.2.2 (2021-05-09)

Changed:

-   api http transport status fixed;

### 3.2.1 (2021-05-09)

Changed:

-   const default export fixed;

### 3.2.0 (2021-05-09)

Changed:

-   const default export;
-   google uule module added;

### 3.1.0 (2021-05-09)

Changed:

-   code improvements;
-   threads api updated;
-   api json upload;
-   api http void calls;
-   dev server cors enabled;
-   ip/range module added;
-   proxy subnet renamed to range;
-   app cli --mode option added;
-   sql .rows fixed;
-   pgsql use maxRows;
-   sqlite driver updated;

### 3.0.1 (2021-05-03)

Changed:

-   deps updated;
-   imports browser-safe;
-   browser events import fixed;
-   maxmind mmdb import fixed;

### 3.0.0 (2021-05-02)

Changed:

-   fs config read cache option renamed to require;

### 3.0.0-alpha.5 (2021-05-02)

Changed:

-   minor code improvements;

### 3.0.0-alpha.4 (2021-05-02)

Changed:

-   ported to ESM;

### 3.0.0-alpha.3 (2021-05-02)

Changed:

-   ported to ESM;

### 3.0.0-alpha.2 (2021-04-28)

Changed:

-   deps updated;

### 3.0.0-alpha.1 (2021-04-28)

Changed:

-   imports reverted;
-   api client websocket close event fixed;

### 3.0.0-alpha.0 (2021-04-28)

Changed:

-   ported to webpack 5;
-   api browser hash-wasm import fixed;

### 2.18.2 (2021-04-27)

Changed:

-   proxy api refactored;

### 2.18.1 (2021-04-26)

Changed:

-   msgpack exports renamed;
-   typo;

### 2.18.0 (2021-04-26)

Changed:

-   api client refactored;
-   msgpack decode buffer fixed;
-   browser exports updated;
-   deps updated;
-   fs resolve method added;
-   add trailing "\n" for readable .json;
-   proxy refactored;
-   proxy resolve property fixed;

### 2.17.6 (2021-04-23)

Changed:

-   mjs export fixed;

### 2.17.5 (2021-04-23)

Changed:

-   global methods updated;
-   devaultPort -> getDefaultPort();
-   proxy session rotation fixed;
-   proxy upstream options fixed;
-   hola api refactored;
-   proxy http auth fixed;

### 2.17.4 (2021-04-23)

Changed:

-   minor proxy update;
-   countries browser removed;
-   timezones browser removed;
-   browser exports updated;
-   browser events exports fixed;
-   uws write status;

### 2.17.3 (2021-04-22)

Changed:

-   proxy server close on auth error;
-   proxy server integration updated;
-   proxy server connection options fixed;
-   proxy server playwright integrated;

### 2.17.2 (2021-04-22)

Changed:

-   proxy playwright integrated;

### 2.17.1 (2021-04-22)

Changed:

-   result moved to own package;
-   #index imports added;

### 2.17.0 (2021-04-21)

Changed:

-   proxy refactored;
-   engines updated;
-   bench refactored;
-   maxmind destroy method added;
-   mem bench added;
-   api load refactored;
-   sql load schema refactored;
-   table use ansi imports;
-   table string.removeANSI();
-   threads worker esm support;
-   imports #resources;
-   fs config reader refactored;
-   threads reverted to cjs;
-   threads ported to es;
-   threads constructor option renamed to arguments;
-   sqlite integer decode to string;
-   maxmind force options added;
-   root path detection updated;
-   proxy server username parser updated;
-   upgraded to uws 19;

### 2.16.0 (2021-04-09)

Changed:

-   proxy server refactored;

### 2.15.5 (2021-04-09)

Changed:

-   proxy server allows to redefine hostname, port;
-   package exports fix for browser;

### 2.15.4 (2021-04-06)

Changed:

-   @softvisio/globals added;
-   playwright moved to own package;

### 2.15.3 (2021-04-05)

Changed:

-   playwright navigator.platform override;
-   npmrc fund false;

### 2.15.2 (2021-04-04)

Changed:

-   plsywright-core support added;

### 2.15.1 (2021-04-04)

Changed:

-   sqlite patches merged;
-   pgsql patches merged;
-   app settings trigger updated;

### 2.15.0 (2021-04-04)

Changed:

-   playwright refactored;
-   update-databases;

### 2.14.2 (2021-04-01)

Changed:

-   maxmind path changed;

### 2.14.1 (2021-04-01)

Changed:

-   playwright useragent patch;

### 2.14.0 (2021-03-30)

Changed:

-   playwright devices added;
-   table ansi autodetect;

### 2.13.3 (2021-03-29)

Changed:

-   maxmind update fixed;

### 2.13.2 (2021-03-29)

Changed:

-   static event name prefix;

### 2.13.1 (2021-03-29)

Changed:

-   threads event name parser fixed;

### 2.13.0 (2021-03-29)

Changed:

-   sql refactored;
-   signal.send remember signal value;
-   SemaphoreSet class added;
-   api cache refactored;
-   dim ansi style added;
-   sqlite defer notifications updated;

### 2.12.2 (2021-03-28)

Changed:

-   deps updated;

### 2.12.1 (2021-03-27)

Changed:

-   sqlite defer notifications;
-   sqlite fixes;
-   sqlite db int8 -> integer;
-   sqlite triggers updated;

### 2.12.0 (2021-03-27)

Changed:

-   api events moved to database;
-   app predefined user permissions renamed;
-   app event publish status fixed;
-   predefined cluster groups names added;

### 2.11.0 (2021-03-27)

Changed:

-   app events refactored;
-   app emit renamed to publish;
-   cli refactored;
-   cli help use table format;

### 2.10.3 (2021-03-25)

Changed:

-   table stringify cell value;

### 2.10.2 (2021-03-25)

Changed:

-   table options updated;
-   linted;

### 2.10.1 (2021-03-24)

Changed:

-   text table fixed;

### 2.10.0 (2021-03-24)

Changed:

-   text table added;

### 2.9.1 (2021-03-23)

Changed:

-   app events scope fixed;
-   string padEnd();

### 2.9.0 (2021-03-22)

Changed:

-   sqlite notifications;
-   pgsql notifications;
-   ArrayBuffer toJSON global hook added;
-   buffer toJSON global hook added;
-   app events renamed;

### 2.8.2 (2021-03-19)

Changed:

-   dbh transaction result parser fixed;

### 2.8.1 (2021-03-19)

Changed:

-   uws proxy;
-   cluster.js moved;

### 2.8.0 (2021-03-19)

Changed:

-   object permissions cache integrated with cluster;
-   use auth cache if cluster is active;
-   make auth cache private;
-   healthcheck always retirn json;
-   cluster service connect event renamed to cluster/service/connect;

### 2.7.0 (2021-03-18)

Changed:

-   app events docs;
-   app/settings/update -> app/settings/update;
-   do not send app/settings/update event on init;
-   app cluster integration;
-   api auth cache refactored;
-   semaphore combined with signal;
-   api healthcheck method added;
-   docker remove dnf cache;

### 2.6.4 (2021-03-16)

Changed:

-   pgsql socket set keepalive;

### 2.6.3 (2021-03-15)

Changed:

-   master -> main;

### 2.6.2 (2021-03-15)

Changed:

-   docker tags updated;

### 2.6.1 (2021-03-15)

Changed:

-   config merge updated;

### 2.6.0 (2021-03-15)

Changed:

-   config files renamed;
-   docker file cleaned;

### 2.5.1 (2021-03-14)

Changed:

-   nginx removed;

### 2.5.0 (2021-03-14)

Changed:

-   fs.config all option added for read yaml multidocuments;
-   redis wrapper added;
-   sql locks index added;
-   redis driver added;

### 2.4.0 (2021-03-14)

Changed:

-   utils/env module added;

### 2.3.0 (2021-03-14)

Changed:

-   sql pg advisory lock during migration;
-   app env local files added;
-   docker entry point changed to package root;
-   docker env cleared;
-   docker-stack updated;

### 2.2.5 (2021-03-12)

Changed:

-   proxy http requests fixed;
-   mime force option added to override types;
-   proxy code cleanup;
-   proxy https headers fixed;
-   port for http proxy fixed;
-   proxy connect fixed;

### 2.2.4 (2021-03-11)

Changed:

-   maxmind env.MAXMIND_LICENSE_KEY;
-   image healthcheck added;

### 2.2.3 (2021-03-10)

Changed:

-   debug log removed;
-   docker-compose.yaml renamed to docker-stack.yaml;
-   api heartbeat timeout set to 40 seconds;

### 2.2.2 (2021-03-09)

Changed:

-   moved to compose file;

### 2.2.1 (2021-03-09)

Changed:

-   maxmind repo path updated;

### 2.2.0 (2021-03-09)

Changed:

-   getEnvBool() supports true only;
-   maxmind module added;
-   tmp files refactored;
-   tmp files unlinkSync() replaced with remove();
-   getRealRemoteAddress fixed;

### 2.1.0 (2021-03-08)

Changed:

-   getRealRemoteAddress updated;
-   loadbalancer config removed;
-   api ping / pong handlers added;
-   deps updated;
-   http api ping / pong support;
-   api client small code improvements;

### 2.0.1 (2021-03-04)

Changed:

-   sqlite object json encoding fixed;
-   sqlite db fixed;

### 2.0.0 (2021-03-03)

Changed:

-   @softvisio/nginx added;

### 2.0.0-rc.5 (2021-03-02)

Changed:

-   ajv apiUpload keyword;
-   api upload refactored;
-   apiReader ajv keyword renamed to apiRead;

### 2.0.0-rc.4 (2021-02-28)

Changed:

-   api browser missing result deps;

### 2.0.0-rc.3 (2021-02-28)

Changed:

-   proxy rotation refactored;
-   api token refactored;
-   luminati session;
-   sql where condition [!=, null] converted to IS NOT NULL;
-   ajv api keywords;
-   require global index;
-   max threads replaced with semaphore;
-   threads signal added;
-   threads mutex added;

### 2.0.0-rc.2 (2021-02-24)

Changed:

-   browser index added;
-   condvar recv callback fixed;

### 2.0.0-rc.1 (2021-02-24)

Changed:

-   Object.pick(), Object.omit() methods fixed;

### 2.0.0-rc.0 (2021-02-24)

Changed:

-   sql SET() signature changed;
-   Object.pick(), Object.omit() methods added;
-   constants use Object.freeze() instead of Proxy;
-   sql code cleanup;
-   sql VALUES() signature changed;

### 2.0.0-beta.14 (2021-02-22)

Changed:

-   smtp ehlo fixed;

### 2.0.0-beta.13 (2021-02-22)

Changed:

-   smtp refactored;
-   docker node engines-strict;
-   engines updated;

### 2.0.0-beta.12 (2021-02-17)

Changed:

-   packetstream proxies fixed;
-   form-data v4;

### 2.0.0-beta.11 (2021-02-14)

Changed:

-   sql migration refactored;
-   bench fixed;

### 2.0.0-beta.10 (2021-02-12)

Changed:

-   threads refactored;
-   threads class name fixed;

### 2.0.0-beta.9 (2021-02-12)

Changed:

-   utils resolution updated;

### 2.0.0-beta.8 (2021-02-12)

Changed:

-   util renamed to utils;

### 2.0.0-beta.7 (2021-02-12)

Changed:

-   max-threads mixin removed;
-   threads/pool moved to ./threads;
-   callable class prototype added;

### 2.0.0-beta.6 (2021-02-09)

Changed:

-   playwright use google-chrome-stable by default on linux;

### 2.0.0-beta.5 (2021-02-09)

Changed:

-   proxy base rotation methods added;
-   proxy server await proxy hook;

### 2.0.0-beta.4 (2021-02-09)

Changed:

-   playwright patch refactored;
-   util getEnvBool function;

### 2.0.0-beta.3 (2021-02-09)

Changed:

-   resource path fixed;

### 2.0.0-beta.2 (2021-02-09)

Changed:

-   resource path fixed;

### 2.0.0-beta.1 (2021-02-09)

Changed:

-   result global init code moved to index;

### 2.0.0-beta.0 (2021-02-09)

Changed:

-   app api init refactored;
-   util functions moved to the global objects;
-   constants moved to separate file;
-   net patch added;
-   stream patch added;
-   ajv msgpack moved to separate file;
-   ajv helper moved to separate file;
-   mixin detection fixed;

### 2.0.0-alpha.1 (2021-02-08)

Changed:

-   playwright helper added;
-   proxy refactored;

### 2.0.0-alpha.0 (2021-02-07)

Changed:

-   proxy refactored;
-   index updated;
-   mixins refactored;
-   proxy timezone removed;
-   tor api added;

### 1.1.0 (2021-02-01)

-   threads/max-threads class added

### 1.0.1 (2021-01-31)

-   package-lock disabled

### 1.0.0 (2021-01-31)

### 0.125.1 (2021-01-31)

-   deps updated

### 0.125.0 (2021-01-30)

-   google serp api removed

### 0.124.0 (2021-01-30)

-   puppeteer removed

### 0.123.16 (2021-01-27)

-   doc fixed for npm 7

### 0.123.15 (2021-01-27)

-   deps updated

### 0.123.14 (2021-01-27)

-   deps updated

### 0.123.13 (2021-01-27)

-   deps updated

### 0.123.12 (2021-01-27)

-   deps updated

### 0.123.11 (2021-01-27)

-   deps updated

### 0.123.10 (2021-01-27)

-   deps updated

### 0.123.9 (2021-01-27)

-   deps updated

### 0.123.8 (2021-01-27)

-   deps updated

### 0.123.7 (2021-01-27)

-   deps updated

### 0.123.6 (2021-01-27)

-   use buffer base65url encoding

### 0.123.5 (2021-01-27)

-   deps updated

### 0.123.4 (2021-01-26)

-   deps updated

### 0.123.3 (2021-01-26)

-   deps updated

### 0.123.2 (2021-01-26)

-   deps updated

### 0.123.1 (2021-01-26)

-   deps updated

### 0.123.0 (2021-01-26)

-   migrated to node v15

### 0.122.1 (2021-01-26)

-   email regexp updated

### 0.122.0 (2021-01-26)

-   fetch chrome option added
-   deps updated

### 0.121.1 (2021-01-25)

-   ajv errors

### 0.121.0 (2021-01-24)

-   ajv errors

### 0.120.0 (2021-01-23)

-   nginx config updated
-   nginx location set to /var/lib

### 0.119.2 (2021-01-21)

-   postgres decode to utf8 string by default

### 0.119.1 (2021-01-21)

-   sql encoders updated
-   postgres buffer decoder fixed
-   postgres buffer encoder fixed
-   sql types updated
-   decimal -> numeric

### 0.119.0 (2021-01-21)

-   sql refactored
-   objectIsGoogleDomain removed
-   objectIsCountry removed
-   objectIsSqlQuery removed
-   objectIsSubnet removed
-   objectIsProxy removed
-   instanceof IPAddr
-   objectIsApp removed
-   objectIsResult removed
-   sql custom types
-   sql encode object to json automatically

### 0.118.2 (2021-01-16)

-   google search api fixed
-   deps updated
-   session token length 16 bytes

### 0.118.1 (2021-01-15)

-   username should not look like uuid

### 0.118.0 (2021-01-15)

-   deps updated
-   ajv plugins added
-   switched to softvisio/msgpack

### 0.117.1 (2021-01-14)

-   token encoder updated

### 0.117.0 (2021-01-14)

-   user session refactored
-   base58 removed
-   auth token refactored
-   deps updated

### 0.116.3 (2021-01-12)

-   user_hash -> auth_hash

### 0.116.2 (2021-01-12)

-   deps updated
-   sql syntax rules applied

### 0.116.1 (2021-01-10)

-   typo

### 0.116.0 (2021-01-10)

-   sqlite safe bigint decode
-   sql syntax rules applied

### 0.115.1 (2021-01-09)

-   deps updated

### 0.115.0 (2021-01-06)

-   api bench added
-   db migration updated
-   api db updated
-   buildApi result
-   api token class

### 0.114.0 (2021-01-06)

-   api token class
-   threads api updated
-   api mixins renamed

### 0.113.1 (2021-01-05)

-   api db schema updated

### 0.113.0 (2021-01-05)

-   api objects config structure updated

### 0.112.0 (2021-01-05)

-   sqlite api refactored
-   sql types updated
-   sqlite schema functions support
-   message pack transparently encode BigInt to string
-   migrate to js-yaml 4
-   linted
-   user tokens api refactored
-   object permissions
-   api db splitted to files

### 0.111.0 (2021-01-02)

-   object permissions
-   sqlite bigint support
-   pgsql BigInt support
-   deps updated
-   constants get protection removed
-   app api builder
-   token permissions
-   app permissions

### 0.110.0 (2020-12-26)

-   constants recursive for plain objects
-   app permissions
-   permission name rules changed

### 0.109.0 (2020-12-21)

-   postgres schema updated
-   sqlite url parser fixed
-   postgres connect to default db

### 0.108.1 (2020-12-19)

-   gyp libc removed
-   deps updated

### 0.108.0 (2020-12-19)

-   http fetch agent refactored

### 0.107.3 (2020-12-17)

-   catchResult fixed
-   root user fields fixed
-   deps updated

### 0.107.2 (2020-12-16)

-   ajv formats added

### 0.107.1 (2020-12-15)

-   ajv strict mode disabled

### 0.107.0 (2020-12-15)

-   deps updated
-   bitbucket api added
-   ip addr to number removed

### 0.106.0 (2020-12-13)

-   proxy server http auth fixed
-   typo

### 0.105.0 (2020-12-13)

-   hola proxy refactored
-   subnet.contains fixed
-   http fetch reason fixed
-   deps updated

### 0.104.0 (2020-12-11)

-   local proxy type added
-   ip addr refactored
-   ip-addr v6 support

### 0.103.0 (2020-12-09)

-   api findMethod
-   result export updated

### 0.102.0 (2020-12-09)

-   node better-sqlite3 updated

### 0.101.0 (2020-12-08)

-   deps updated
-   uws deps updated
-   argon2 updated

### 0.100.0 (2020-12-08)

-   res isError -> error
-   res isException -> exception
-   maxmind db refactored
-   http api params fixed
-   result inheritable
-   deps updated
-   google serp api desc -> description

### 0.99.0 (2020-12-07)

-   maxmind geolite2 updated
-   max-threads events added
-   deps updated

### 0.98.1 (2020-12-04)

-   google serp api onItem params changed

### 0.98.0 (2020-12-04)

-   google serp onItem hook

### 0.97.0 (2020-12-04)

-   deps updated
-   max-threads mixin accept function as thread param

### 0.96.0 (2020-12-01)

-   google serp api pos -> position
-   api class moved

### 0.95.0 (2020-11-28)

-   hola country option
-   linted

### 0.94.0 (2020-11-26)

-   pgsql extensions added

### 0.93.0 (2020-11-26)

-   added browser events emitter
-   seorank api

### 0.92.0 (2020-11-26)

-   hola proxy

### 0.91.2 (2020-11-23)

-   typo

### 0.91.1 (2020-11-23)

-   docker tags mapping renamed

### 0.91.0 (2020-11-23)

-   api call log
-   deps updated
-   global result
-   result refactored
-   dbh error returns result exception
-   bench docs fixed
-   api extends event emitter

### 0.90.0 (2020-11-16)

-   2captcha api constructor params updated
-   deps updated

### 0.89.0 (2020-11-16)

-   app init refactored

### 0.88.0 (2020-11-16)

-   mime getByFilename shebang options added

### 0.87.0 (2020-11-14)

-   server websockets idle timeout 3 minutes
-   server websockets backpressure disabled

### 0.86.11 (2020-11-12)

-   google serp configurable timeout

### 0.86.10 (2020-11-12)

-   google serp configurable max retries

### 0.86.9 (2020-11-08)

-   google serp els length fixed
-   readme updated
-   uws binary host removed
-   deps updated

### 0.86.8 (2020-11-08)

-   proxy refactored

### 0.86.7 (2020-11-06)

-   google serp traffic counters removed
-   google serp use incognito
-   puppeteer disable --single-process to make incognito works
-   countries get by coords

### 0.86.6 (2020-11-06)

-   http api handle request aborted

### 0.86.5 (2020-11-05)

-   websocket control if connection is alive
-   getRandomFreePort refactored
-   server listen rndom port refactored

### 0.86.4 (2020-11-04)

-   google serp refactored
-   deps updated

### 0.86.3 (2020-11-02)

-   google serpimezone only for non-persistent browsers
-   serp disable geolocation in no coordinates provided
-   google serp use max when search for position

### 0.86.2 (2020-11-02)

-   proxy server sessions

### 0.86.1 (2020-11-02)

-   serp count traffic, only for non-persistent browsers
-   serp device added

### 0.86.0 (2020-11-02)

-   deps updated
-   countries coordinates added
-   api google serp refactored
-   max threads mixin refactored

### 0.85.3 (2020-10-28)

-   google serp domains fixed

### 0.85.2 (2020-10-28)

-   packetstream country code refactored
-   continents db added
-   subnets db updated

### 0.85.1 (2020-10-27)

-   object type validation fixed

### 0.85.0 (2020-10-27)

-   docs updated
-   countries db refactored for browser
-   subnets refactored
-   deps updated
-   mime updated
-   databases updated
-   languages db added
-   currencies db added

### 0.84.0 (2020-10-26)

-   timezones db added
-   maxmind moved to db
-   mime moved to db
-   packetstream proxy country fixed
-   proxy class names changed
-   const refactored
-   sql type getters added
-   proxy type getters added
-   sql props converted to getter
-   proxy country to lower case
-   countries db added

### 0.83.0 (2020-10-25)

-   google domains db added

### 0.82.2 (2020-10-23)

-   docker node downgraded to 14

### 0.82.1 (2020-10-23)

-   deps updated

### 0.82.0 (2020-10-23)

-   api session.\_getAppSettings method async

### 0.81.1 (2020-10-22)

-   dockerfile fixed

### 0.81.0 (2020-10-22)

-   docker tags mapping added

### 0.80.2 (2020-10-22)

-   npm 7 reverted to 6

### 0.80.1 (2020-10-22)

-   deps updated
-   readme

### 0.80.0 (2020-10-18)

-   app config refactored

### 0.79.0 (2020-10-17)

-   cli short options fixed
-   load app settings from .config.yaml

### 0.78.0 (2020-10-16)

-   puppeteer refactored
-   fs tmp refactored

### 0.77.0 (2020-10-15)

-   api docs formatted
-   linted
-   yaml comments formatted
-   yaml comments flow level removed
-   proxy type added
-   packetstream proxy
-   deps updated

### 0.76.0 (2020-10-10)

-   puppeteer devices refactored
-   proxy server stat event

### 0.75.0 (2020-10-09)

-   puppeteer proxy option supports boolean values
-   proxy server stats

### 0.74.0 (2020-10-08)

-   app set root password from file on init
-   code cleanup

### 0.73.2 (2020-10-08)

-   api base class moved

### 0.73.1 (2020-10-07)

-   api token read fixed

### 0.73.0 (2020-10-07)

-   get app settings getter
-   app auth getters
-   api classes constructor removed
-   api getters

### 0.72.1 (2020-10-07)

-   deps updated
-   google serp fixed

### 0.72.0 (2020-09-30)

-   pptr headfulMaximized option

### 0.71.0 (2020-09-29)

-   proxy server stats
-   deps updated

### 0.70.0 (2020-09-20)

-   puppeteer devices refactored
-   puppeteer devices resolutions added
-   deps updated
-   docker mirrors
-   docker LIBC env var exported

### 0.69.0 (2020-09-17)

-   2captcha docs fixed
-   google serp api added
-   proxy sockets destroy fixed
-   puppeteer timezone emulation refactored
-   puppeteer devices added

### 0.68.1 (2020-09-15)

-   deps updated

### 0.68.0 (2020-09-15)

-   dns class added
-   proxy server resolve
-   proxy resolveHostname method removed
-   resolve option removed from proxy
-   puppeteer refactored
-   proxy startSession() options
-   deps updated
-   puppeteer devices
-   proxy server refactored
-   puppeteer windows size added
-   maxmind unref updater timer
-   app props replaced with getters
-   api http endpoints refactored

### 0.67.0 (2020-09-06)

-   api GET endpoints added
-   api POST endpoints added

### 0.66.0 (2020-09-05)

-   deps updated
-   uws tag changed to latest
-   smtp refactored
-   nodemailer removed
-   readLine refactored
-   readChunk, readLine encoding option added

### 0.65.1 (2020-09-03)

-   nginx tmpl path fixed

### 0.65.0 (2020-09-03)

-   nginx moved to root
-   smtp moved to root
-   puppeteer default args updated
-   puppeteer moved to the root
-   docker make global node modules loadable

### 0.64.1 (2020-09-02)

-   puppeteer arguments added

### 0.64.0 (2020-09-02)

-   luminati proxy getters added

### 0.63.5 (2020-09-01)

-   api log params validation errors in devel mode
-   api devel property added
-   smtp refactored

### 0.63.4 (2020-08-31)

-   app log on installing loadbalancer config

### 0.63.3 (2020-08-31)

-   debug log removed

### 0.63.2 (2020-08-31)

-   cache control headers fixed
-   nginx vhost config updated

### 0.63.1 (2020-08-31)

-   geolite2-redist source updated

### 0.63.0 (2020-08-31)

-   proxy get peer ip refactored
-   maxmind refactored
-   ip-addr geo, asn properties added

### 0.62.0 (2020-08-30)

-   maxmind wrapper added
-   puppeteer.proxy -> .proxyServer
-   debug log removed

### 0.61.3 (2020-08-30)

-   proxy dns use resolve()
-   proxy options parser imprved

### 0.61.2 (2020-08-30)

-   deps updated

### 0.61.1 (2020-08-30)

-   proxy.session -> proxy.sessionId

### 0.61.0 (2020-08-30)

-   proxy refactored
-   luminati proxy type added

### 0.60.0 (2020-08-28)

-   api admin/users/set-username method added
-   api setUserName method added
-   api process usernameIsEmail option on create user
-   puppeteer uses google chrome stable by default on linux

### 0.59.0 (2020-08-27)

-   sql supporn for nested transactions added
-   util bufferToUuid, uuidToBuffer removed
-   sql inTransaction getter
-   local api methods supports optional dbh parameter

### 0.58.1 (2020-08-25)

-   deps updated
-   2captcha request method fixed

### 0.58.0 (2020-08-24)

-   puppeteer api added
-   2captcha class added
-   deps updated

### 0.57.0 (2020-08-22)

-   util quotemeta func added
-   archive.org api
-   majestic api
-   moz api
-   namesilo api refactored
-   MaxThreads class added
-   semaphore refactored
-   fetch creates agent if proxy is specified
-   proxy url parsing improved

### 0.56.0 (2020-08-21)

-   api setUserPassword accepts user id or name
-   api setUserEnabled accepts user id or name
-   api admin/users/set-password endpoint added
-   api token permissions merge fixed

### 0.55.0 (2020-08-19)

-   api tokens

### 0.54.0 (2020-08-19)

-   token type converted to string

### 0.53.0 (2020-08-19)

-   api tokens structire updated
-   bytesToUuid renamed to bufferToUuid
-   nginx conf tabs fixed

### 0.52.1 (2020-08-19)

-   webpack cache-control updated
-   nginx proxy add-modified-since header added
-   api handle token decode errors

### 0.52.0 (2020-08-18)

-   token encoded as base58
-   util toBase58, fromBase58 functions added
-   base-x deps added
-   encode default password to base64u
-   default password length set to 16 bytes

### 0.51.1 (2020-08-18)

-   allow to send event to the several threads at once

### 0.51.0 (2020-08-18)

-   allow to send event to multiple users at once
-   api getObjectUsers method added

### 0.50.0 (2020-08-17)

-   deps updated
-   threads return 404 in thread not found
-   namesilo api updated

### 0.49.0 (2020-08-17)

-   namesilo api
-   http/fetch duplicate statusText in reason property
-   api user object id renamed to guid
-   http agent tls servername added
-   ip-addr refactored
-   status codes updated

### 0.48.5 (2020-08-15)

-   proxy server authentication

### 0.48.4 (2020-08-15)

-   proxy server check connection type before connect to upstream proxy
-   node-fetch wrapper added

### 0.48.3 (2020-08-15)

-   proxy server refactored
-   proxy socket error handlers
-   util readLine params changed

### 0.48.2 (2020-08-14)

-   proxy server socks5 connection protocol updated

### 0.48.1 (2020-08-13)

-   proxy server refactored
-   https proxy refactored
-   http proxy refactored

### 0.48.0 (2020-08-13)

-   ip-addr subnet cidr mask fixed
-   proxies added
-   server moved to http/server
-   typo in dockerfile
-   util readChunk function added

### 0.47.1 (2020-08-08)

-   api validate email regexp updated
-   api username length expanded to 255 chars

### 0.47.0 (2020-08-08)

-   electron updates app mixin

### 0.46.0 (2020-08-08)

-   app env substitute vars

### 0.45.3 (2020-08-07)

-   .eslintrc.yaml removed
-   api schema skipParamsValidation -> noParamsValidation

### 0.45.2 (2020-08-05)

-   shrinkwrap updated

### 0.45.1 (2020-08-03)

-   deps updated
-   shrinkwrap added
-   chain proxy server class added
-   api class template updated

### 0.45.0 (2020-08-02)

-   docs yaml dump settings updated
-   docs multiline yaml fixed
-   wiki markdown links fixed for bitbucket
-   api signin method docs updated
-   chrome removed in favour of puppeteer

### 0.44.3 (2020-07-31)

-   nginx vhost renamed to vhosts
-   engines added to package.json

### 0.44.2 (2020-07-30)

-   docker file updated
-   docker remove cached node
-   docker pre-build urls updated

### 0.44.1 (2020-07-25)

-   npm prebuild binary hosts added
-   npm git links changed to git+https

### 0.44.0 (2020-07-22)

-   api auth_hash table renamed to user_hash
-   settings smtp from field added

### 0.43.1 (2020-07-21)

-   upsert user auth hash

### 0.43.0 (2020-07-21)

-   session signin statuses added
-   doc block parser fixed
-   fs.config.write fixed

### 0.42.1 (2020-07-21)

-   signin permissions renamed

### 0.42.0 (2020-07-21)

-   api session/signin added possibility to check user permissions on sign in

### 0.41.0 (2020-07-21)

-   server memory cache removed
-   loadbalancer config updated
-   app.listen renamed to app.\_listen

### 0.40.0 (2020-07-20)

-   unlink tmp on process exit

### 0.39.0 (2020-07-20)

-   docs fixed
-   ip-addr class added

### 0.38.0 (2020-07-19)

-   chrome api prototype
-   cloudflare cidrs added
-   getRealIP method added
-   nginx loadbalancer config updated
-   cache-control fixed for proxies
-   api client "persistent" replaced with "onDemand"
-   api "ping" message type added

### 0.37.0 (2020-07-18)

-   dockerfile updated
-   project location in docker renamed to /var/local/dist

### 0.36.0 (2020-07-18)

-   util getRandomFreePort, portIsFree functions added
-   ejs sync render
-   nginx loadbalancer config added

### 0.35.0 (2020-07-17)

-   UserName -> Username
-   userName -> username
-   lint patterns updated

### 0.34.0 (2020-07-16)

-   ansi colors added

### 0.33.4 (2020-07-16)

-   docs fixed

### 0.33.3 (2020-07-16)

-   user_name -> username

### 0.33.2 (2020-07-15)

-   wiki generator fixed

### 0.33.1 (2020-07-15)

-   wiki generator fixed

### 0.33.0 (2020-07-15)

-   docs generator
-   file tree isEmpty() method added
-   cli help fixed
-   docs fixed
-   confirm prompt fixed
-   changelog format updated

### 0.32.2 (2020-07-12)

-   .eslintrc.yaml updated

### 0.32.1 (2020-07-11)

-   docker clean dnf cache

### 0.32.0 (2020-07-10)

-   mime refactored
-   lint config added to package.json
-   readTree replaced with glob
-   cli allow - and -- arguments
-   cli option required fixed

### 0.31.0 (2020-07-08)

-   fs.tmp.dir added
-   .docker.yaml added

### 0.30.0 (2020-07-08)

-   cli boolean options refactored
-   code cleanup

### 0.29.0 (2020-07-07)

-   utils confirm functions added
