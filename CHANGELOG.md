## 2.14.2 (2021-04-01)

### Raw commits log

-   maxmind path changed;

## 2.14.1 (2021-04-01)

### Raw commits log

-   playwright useragent patch;

## 2.14.0 (2021-03-30)

### Raw commits log

-   playwright devices added;
-   table ansi autodetect;

## 2.13.3 (2021-03-29)

### Raw commits log

-   maxmind update fixed;

## 2.13.2 (2021-03-29)

### Raw commits log

-   static event name prefix;

## 2.13.1 (2021-03-29)

### Raw commits log

-   threads event name parser fixed;

## 2.13.0 (2021-03-29)

### Raw commits log

-   sql refactored;
-   signal.send remember signal value;
-   SemaphoreSet class added;
-   api cache refactored;
-   dim ansi style added;
-   sqlite defer notifications updated;

## 2.12.2 (2021-03-28)

### Raw commits log

-   deps updated;

## 2.12.1 (2021-03-27)

### Raw commits log

-   sqlite defer notifications;
-   sqlite fixes;
-   sqlite db int8 -> integer;
-   sqlite triggers updated;

## 2.12.0 (2021-03-27)

### Raw commits log

-   api events moved to database;
-   app predefined user permissions renamed;
-   app event publish status fixed;
-   predefined cluster groups names added;

## 2.11.0 (2021-03-27)

### Raw commits log

-   app events refactored;
-   app emit renamed to publish;
-   cli refactored;
-   cli help use table format;

## 2.10.3 (2021-03-25)

### Raw commits log

-   table stringify cell value;

## 2.10.2 (2021-03-25)

### Raw commits log

-   table options updated;
-   linted;

## 2.10.1 (2021-03-24)

### Raw commits log

-   text table fixed;

## 2.10.0 (2021-03-24)

### Raw commits log

-   text table added;

## 2.9.1 (2021-03-23)

### Raw commits log

-   app events scope fixed;
-   string padEnd();

## 2.9.0 (2021-03-22)

### Raw commits log

-   sqlite notifications;
-   pgsql notifications;
-   ArrayBuffer toJSON global hook added;
-   buffer toJSON global hook added;
-   app events renamed;

## 2.8.2 (2021-03-19)

### Raw commits log

-   dbh transaction result parser fixed;

## 2.8.1 (2021-03-19)

### Raw commits log

-   uws proxy;
-   cluster.js moved;

## 2.8.0 (2021-03-19)

### Raw commits log

-   object permissions cache integrated with cluster;
-   use auth cache if cluster is active;
-   make auth cache private;
-   healthcheck always retirn json;
-   cluster service connect event renamed to cluster/service/connect;

## 2.7.0 (2021-03-18)

### Raw commits log

-   app events docs;
-   app/settings/update -> app/settings/update;
-   do not send app/settings/update event on init;
-   app cluster integration;
-   api auth cache refactored;
-   semaphore combined with signal;
-   api healthcheck method added;
-   docker remove dnf cache;

## 2.6.4 (2021-03-16)

### Raw commits log

-   pgsql socket set keepalive;

## 2.6.3 (2021-03-15)

### Raw commits log

-   master -> main;

## 2.6.2 (2021-03-15)

### Raw commits log

-   docker tags updated;

## 2.6.1 (2021-03-15)

### Raw commits log

-   config merge updated;

## 2.6.0 (2021-03-15)

### Raw commits log

-   config files renamed;
-   docker file cleaned;

## 2.5.1 (2021-03-14)

### Raw commits log

-   nginx removed;

## 2.5.0 (2021-03-14)

### Raw commits log

-   fs.config all option added for read yaml multidocuments;
-   redis wrapper added;
-   sql locks index added;
-   redis driver added;

## 2.4.0 (2021-03-14)

### Raw commits log

-   utils/env module added;

## 2.3.0 (2021-03-14)

### Raw commits log

-   sql pg advisory lock during migration;
-   app env local files added;
-   docker entry point changed to package root;
-   docker env cleared;
-   docker-stack updated;

## 2.2.5 (2021-03-12)

### Raw commits log

-   proxy http requests fixed;
-   mime force option added to override types;
-   proxy code cleanup;
-   proxy https headers fixed;
-   port for http proxy fixed;
-   proxy connect fixed;

## 2.2.4 (2021-03-11)

### Raw commits log

-   maxmind env.MAXMIND_LICENSE_KEY;
-   image healthcheck added;

## 2.2.3 (2021-03-10)

### Raw commits log

-   debug log removed;
-   docker-compose.yaml renamed to docker-stack.yaml;
-   api heartbeat timeout set to 40 seconds;

## 2.2.2 (2021-03-09)

### Raw commits log

-   moved to compose file;

## 2.2.1 (2021-03-09)

### Raw commits log

-   maxmind repo path updated;

## 2.2.0 (2021-03-09)

### Raw commits log

-   getEnvBool() supports true only;
-   maxmind module added;
-   tmp files refactored;
-   tmp files unlinkSync() replaced with remove();
-   getRealRemoteAddress fixed;

## 2.1.0 (2021-03-08)

### Raw commits log

-   getRealRemoteAddress updated;
-   loadbalancer config removed;
-   api ping / pong handlers added;
-   deps updated;
-   http api ping / pong support;
-   api client small code improvements;

## 2.0.1 (2021-03-04)

### Raw commits log

-   sqlite object json encoding fixed;
-   sqlite db fixed;

## 2.0.0 (2021-03-03)

### Raw commits log

-   @softvisio/nginx added;

## 2.0.0-rc.5 (2021-03-02)

### Raw commits log

-   ajv apiUpload keyword;
-   api upload refactored;
-   apiReader ajv keyword renamed to apiRead;

## 2.0.0-rc.4 (2021-02-28)

### Raw commits log

-   api browser missing result deps;

## 2.0.0-rc.3 (2021-02-28)

### Raw commits log

-   proxy rotation refactored;
-   api token refactored;
-   luminati session;
-   sql where condition [!=, null] converted to IS NOT NULL;
-   ajv api keywords;
-   require global index;
-   max threads replaced with semaphore;
-   threads signal added;
-   threads mutex added;

## 2.0.0-rc.2 (2021-02-24)

### Raw commits log

-   browser index added;
-   condvar recv callback fixed;

## 2.0.0-rc.1 (2021-02-24)

### Raw commits log

-   Object.pick(), Object.omit() methods fixed;

## 2.0.0-rc.0 (2021-02-24)

### Raw commits log

-   sql SET() signature changed;
-   Object.pick(), Object.omit() methods added;
-   constants use Object.freeze() instead of Proxy;
-   sql code cleanup;
-   sql VALUES() signature changed;

## 2.0.0-beta.14 (2021-02-22)

### Raw commits log

-   smtp ehlo fixed;

## 2.0.0-beta.13 (2021-02-22)

### Raw commits log

-   smtp refactored;
-   docker node engines-strict;
-   engines updated;

## 2.0.0-beta.12 (2021-02-17)

### Raw commits log

-   packetstream proxies fixed;
-   form-data v4;

## 2.0.0-beta.11 (2021-02-14)

### Raw commits log

-   sql migration refactored;
-   bench fixed;

## 2.0.0-beta.10 (2021-02-12)

### Raw commits log

-   threads refactored;
-   threads class name fixed;

## 2.0.0-beta.9 (2021-02-12)

### Raw commits log

-   utils resolution updated;

## 2.0.0-beta.8 (2021-02-12)

### Raw commits log

-   util renamed to utils;

## 2.0.0-beta.7 (2021-02-12)

### Raw commits log

-   max-threads mixin removed;
-   threads/pool moved to ./threads;
-   callable class prototype added;

## 2.0.0-beta.6 (2021-02-09)

### Raw commits log

-   playwright use google-chrome-stable by default on linux;

## 2.0.0-beta.5 (2021-02-09)

### Raw commits log

-   proxy base rotation methods added;
-   proxy server await proxy hook;

## 2.0.0-beta.4 (2021-02-09)

### Raw commits log

-   playwright patch refactored;
-   util getEnvBool function;

## 2.0.0-beta.3 (2021-02-09)

### Raw commits log

-   resource path fixed;

## 2.0.0-beta.2 (2021-02-09)

### Raw commits log

-   resource path fixed;

## 2.0.0-beta.1 (2021-02-09)

### Raw commits log

-   result global init code moved to index;

## 2.0.0-beta.0 (2021-02-09)

### Raw commits log

-   app api init refactored;
-   util functions moved to the global objects;
-   constants moved to separate file;
-   net patch added;
-   stream patch added;
-   ajv msgpack moved to separate file;
-   ajv helper moved to separate file;
-   mixin detection fixed;

## 2.0.0-alpha.1 (2021-02-08)

### Raw commits log

-   playwright helper added;
-   proxy refactored;

## 2.0.0-alpha.0 (2021-02-07)

### Raw commits log

-   proxy refactored;
-   index updated;
-   mixins refactored;
-   proxy timezone removed;
-   tor api added;

## 1.1.0 (2021-02-01)

-   threads/max-threads class added

## 1.0.1 (2021-01-31)

-   package-lock disabled

## 1.0.0 (2021-01-31)

## 0.125.1 (2021-01-31)

-   deps updated

## 0.125.0 (2021-01-30)

-   google serp api removed

## 0.124.0 (2021-01-30)

-   puppeteer removed

## 0.123.16 (2021-01-27)

-   doc fixed for npm 7

## 0.123.15 (2021-01-27)

-   deps updated

## 0.123.14 (2021-01-27)

-   deps updated

## 0.123.13 (2021-01-27)

-   deps updated

## 0.123.12 (2021-01-27)

-   deps updated

## 0.123.11 (2021-01-27)

-   deps updated

## 0.123.10 (2021-01-27)

-   deps updated

## 0.123.9 (2021-01-27)

-   deps updated

## 0.123.8 (2021-01-27)

-   deps updated

## 0.123.7 (2021-01-27)

-   deps updated

## 0.123.6 (2021-01-27)

-   use buffer base65url encoding

## 0.123.5 (2021-01-27)

-   deps updated

## 0.123.4 (2021-01-26)

-   deps updated

## 0.123.3 (2021-01-26)

-   deps updated

## 0.123.2 (2021-01-26)

-   deps updated

## 0.123.1 (2021-01-26)

-   deps updated

## 0.123.0 (2021-01-26)

-   migrated to node v15

## 0.122.1 (2021-01-26)

-   email regexp updated

## 0.122.0 (2021-01-26)

-   fetch chrome option added
-   deps updated

## 0.121.1 (2021-01-25)

-   ajv errors

## 0.121.0 (2021-01-24)

-   ajv errors

## 0.120.0 (2021-01-23)

-   nginx config updated
-   nginx location set to /var/lib

## 0.119.2 (2021-01-21)

-   postgres decode to utf8 string by default

## 0.119.1 (2021-01-21)

-   sql encoders updated
-   postgres buffer decoder fixed
-   postgres buffer encoder fixed
-   sql types updated
-   decimal -> numeric

## 0.119.0 (2021-01-21)

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

## 0.118.2 (2021-01-16)

-   google search api fixed
-   deps updated
-   session token length 16 bytes

## 0.118.1 (2021-01-15)

-   username should not look like uuid

## 0.118.0 (2021-01-15)

-   deps updated
-   ajv plugins added
-   switched to softvisio/msgpack

## 0.117.1 (2021-01-14)

-   token encoder updated

## 0.117.0 (2021-01-14)

-   user session refactored
-   base58 removed
-   auth token refactored
-   deps updated

## 0.116.3 (2021-01-12)

-   user_hash -> auth_hash

## 0.116.2 (2021-01-12)

-   deps updated
-   sql syntax rules applied

## 0.116.1 (2021-01-10)

-   typo

## 0.116.0 (2021-01-10)

-   sqlite safe bigint decode
-   sql syntax rules applied

## 0.115.1 (2021-01-09)

-   deps updated

## 0.115.0 (2021-01-06)

-   api bench added
-   db migration updated
-   api db updated
-   buildApi result
-   api token class

## 0.114.0 (2021-01-06)

-   api token class
-   threads api updated
-   api mixins renamed

## 0.113.1 (2021-01-05)

-   api db schema updated

## 0.113.0 (2021-01-05)

-   api objects config structure updated

## 0.112.0 (2021-01-05)

-   sqlite api refactored
-   sql types updated
-   sqlite schema functions support
-   message pack transparently encode BigInt to string
-   migrate to js-yaml 4
-   linted
-   user tokens api refactored
-   object permissions
-   api db splitted to files

## 0.111.0 (2021-01-02)

-   object permissions
-   sqlite bigint support
-   pgsql BigInt support
-   deps updated
-   constants get protection removed
-   app api builder
-   token permissions
-   app permissions

## 0.110.0 (2020-12-26)

-   constants recursive for plain objects
-   app permissions
-   permission name rules changed

## 0.109.0 (2020-12-21)

-   postgres schema updated
-   sqlite url parser fixed
-   postgres connect to default db

## 0.108.1 (2020-12-19)

-   gyp libc removed
-   deps updated

## 0.108.0 (2020-12-19)

-   http fetch agent refactored

## 0.107.3 (2020-12-17)

-   catchResult fixed
-   root user fields fixed
-   deps updated

## 0.107.2 (2020-12-16)

-   ajv formats added

## 0.107.1 (2020-12-15)

-   ajv strict mode disabled

## 0.107.0 (2020-12-15)

-   deps updated
-   bitbucket api added
-   ip addr to number removed

## 0.106.0 (2020-12-13)

-   proxy server http auth fixed
-   typo

## 0.105.0 (2020-12-13)

-   hola proxy refactored
-   subnet.contains fixed
-   http fetch reason fixed
-   deps updated

## 0.104.0 (2020-12-11)

-   local proxy type added
-   ip addr refactored
-   ip-addr v6 support

## 0.103.0 (2020-12-09)

-   api findMethod
-   result export updated

## 0.102.0 (2020-12-09)

-   node better-sqlite3 updated

## 0.101.0 (2020-12-08)

-   deps updated
-   uws deps updated
-   argon2 updated

## 0.100.0 (2020-12-08)

-   res isError -> error
-   res isException -> exception
-   maxmind db refactored
-   http api params fixed
-   result inheritable
-   deps updated
-   google serp api desc -> description

## 0.99.0 (2020-12-07)

-   maxmind geolite2 updated
-   max-threads events added
-   deps updated

## 0.98.1 (2020-12-04)

-   google serp api onItem params changed

## 0.98.0 (2020-12-04)

-   google serp onItem hook

## 0.97.0 (2020-12-04)

-   deps updated
-   max-threads mixin accept function as thread param

## 0.96.0 (2020-12-01)

-   google serp api pos -> position
-   api class moved

## 0.95.0 (2020-11-28)

-   hola country option
-   linted

## 0.94.0 (2020-11-26)

-   pgsql extensions added

## 0.93.0 (2020-11-26)

-   added browser events emitter
-   seorank api

## 0.92.0 (2020-11-26)

-   hola proxy

## 0.91.2 (2020-11-23)

-   typo

## 0.91.1 (2020-11-23)

-   docker tags mapping renamed

## 0.91.0 (2020-11-23)

-   api call log
-   deps updated
-   global result
-   result refactored
-   dbh error returns result exception
-   bench docs fixed
-   api extends event emitter

## 0.90.0 (2020-11-16)

-   2captcha api constructor params updated
-   deps updated

## 0.89.0 (2020-11-16)

-   app init refactored

## 0.88.0 (2020-11-16)

-   mime getByFilename shebang options added

## 0.87.0 (2020-11-14)

-   server websockets idle timeout 3 minutes
-   server websockets backpressure disabled

## 0.86.11 (2020-11-12)

-   google serp configurable timeout

## 0.86.10 (2020-11-12)

-   google serp configurable max retries

## 0.86.9 (2020-11-08)

-   google serp els length fixed
-   readme updated
-   uws binary host removed
-   deps updated

## 0.86.8 (2020-11-08)

-   proxy refactored

## 0.86.7 (2020-11-06)

-   google serp traffic counters removed
-   google serp use incognito
-   puppeteer disable --single-process to make incognito works
-   countries get by coords

## 0.86.6 (2020-11-06)

-   http api handle request aborted

## 0.86.5 (2020-11-05)

-   websocket control if connection is alive
-   getRandomFreePort refactored
-   server listen rndom port refactored

## 0.86.4 (2020-11-04)

-   google serp refactored
-   deps updated

## 0.86.3 (2020-11-02)

-   google serpimezone only for non-persistent browsers
-   serp disable geolocation in no coordinates provided
-   google serp use max when search for position

## 0.86.2 (2020-11-02)

-   proxy server sessions

## 0.86.1 (2020-11-02)

-   serp count traffic, only for non-persistent browsers
-   serp device added

## 0.86.0 (2020-11-02)

-   deps updated
-   countries coordinates added
-   api google serp refactored
-   max threads mixin refactored

## 0.85.3 (2020-10-28)

-   google serp domains fixed

## 0.85.2 (2020-10-28)

-   packetstream country code refactored
-   continents db added
-   subnets db updated

## 0.85.1 (2020-10-27)

-   object type validation fixed

## 0.85.0 (2020-10-27)

-   docs updated
-   countries db refactored for browser
-   subnets refactored
-   deps updated
-   mime updated
-   databases updated
-   languages db added
-   currencies db added

## 0.84.0 (2020-10-26)

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

## 0.83.0 (2020-10-25)

-   google domains db added

## 0.82.2 (2020-10-23)

-   docker node downgraded to 14

## 0.82.1 (2020-10-23)

-   deps updated

## 0.82.0 (2020-10-23)

-   api session.\_getAppSettings method async

## 0.81.1 (2020-10-22)

-   dockerfile fixed

## 0.81.0 (2020-10-22)

-   docker tags mapping added

## 0.80.2 (2020-10-22)

-   npm 7 reverted to 6

## 0.80.1 (2020-10-22)

-   deps updated
-   readme

## 0.80.0 (2020-10-18)

-   app config refactored

## 0.79.0 (2020-10-17)

-   cli short options fixed
-   load app settings from .config.yaml

## 0.78.0 (2020-10-16)

-   puppeteer refactored
-   fs tmp refactored

## 0.77.0 (2020-10-15)

-   api docs formatted
-   linted
-   yaml comments formatted
-   yaml comments flow level removed
-   proxy type added
-   packetstream proxy
-   deps updated

## 0.76.0 (2020-10-10)

-   puppeteer devices refactored
-   proxy server stat event

## 0.75.0 (2020-10-09)

-   puppeteer proxy option supports boolean values
-   proxy server stats

## 0.74.0 (2020-10-08)

-   app set root password from file on init
-   code cleanup

## 0.73.2 (2020-10-08)

-   api base class moved

## 0.73.1 (2020-10-07)

-   api token read fixed

## 0.73.0 (2020-10-07)

-   get app settings getter
-   app auth getters
-   api classes constructor removed
-   api getters

## 0.72.1 (2020-10-07)

-   deps updated
-   google serp fixed

## 0.72.0 (2020-09-30)

-   pptr headfulMaximized option

## 0.71.0 (2020-09-29)

-   proxy server stats
-   deps updated

## 0.70.0 (2020-09-20)

-   puppeteer devices refactored
-   puppeteer devices resolutions added
-   deps updated
-   docker mirrors
-   docker LIBC env var exported

## 0.69.0 (2020-09-17)

-   2captcha docs fixed
-   google serp api added
-   proxy sockets destroy fixed
-   puppeteer timezone emulation refactored
-   puppeteer devices added

## 0.68.1 (2020-09-15)

-   deps updated

## 0.68.0 (2020-09-15)

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

## 0.67.0 (2020-09-06)

-   api GET endpoints added
-   api POST endpoints added

## 0.66.0 (2020-09-05)

-   deps updated
-   uws tag changed to latest
-   smtp refactored
-   nodemailer removed
-   readLine refactored
-   readChunk, readLine encoding option added

## 0.65.1 (2020-09-03)

-   nginx tmpl path fixed

## 0.65.0 (2020-09-03)

-   nginx moved to root
-   smtp moved to root
-   puppeteer default args updated
-   puppeteer moved to the root
-   docker make global node modules loadable

## 0.64.1 (2020-09-02)

-   puppeteer arguments added

## 0.64.0 (2020-09-02)

-   luminati proxy getters added

## 0.63.5 (2020-09-01)

-   api log params validation errors in devel mode
-   api devel property added
-   smtp refactored

## 0.63.4 (2020-08-31)

-   app log on installing loadbalancer config

## 0.63.3 (2020-08-31)

-   debug log removed

## 0.63.2 (2020-08-31)

-   cache control headers fixed
-   nginx vhost config updated

## 0.63.1 (2020-08-31)

-   geolite2-redist source updated

## 0.63.0 (2020-08-31)

-   proxy get peer ip refactored
-   maxmind refactored
-   ip-addr geo, asn properties added

## 0.62.0 (2020-08-30)

-   maxmind wrapper added
-   puppeteer.proxy -> .proxyServer
-   debug log removed

## 0.61.3 (2020-08-30)

-   proxy dns use resolve()
-   proxy options parser imprved

## 0.61.2 (2020-08-30)

-   deps updated

## 0.61.1 (2020-08-30)

-   proxy.session -> proxy.sessionId

## 0.61.0 (2020-08-30)

-   proxy refactored
-   luminati proxy type added

## 0.60.0 (2020-08-28)

-   api admin/users/set-username method added
-   api setUserName method added
-   api process usernameIsEmail option on create user
-   puppeteer uses google chrome stable by default on linux

## 0.59.0 (2020-08-27)

-   sql supporn for nested transactions added
-   util bufferToUuid, uuidToBuffer removed
-   sql inTransaction getter
-   local api methods supports optional dbh parameter

## 0.58.1 (2020-08-25)

-   deps updated
-   2captcha request method fixed

## 0.58.0 (2020-08-24)

-   puppeteer api added
-   2captcha class added
-   deps updated

## 0.57.0 (2020-08-22)

-   util quotemeta func added
-   archive.org api
-   majestic api
-   moz api
-   namesilo api refactored
-   MaxThreads class added
-   semaphore refactored
-   fetch creates agent if proxy is specified
-   proxy url parsing improved

## 0.56.0 (2020-08-21)

-   api setUserPassword accepts user id or name
-   api setUserEnabled accepts user id or name
-   api admin/users/set-password endpoint added
-   api token permissions merge fixed

## 0.55.0 (2020-08-19)

-   api tokens

## 0.54.0 (2020-08-19)

-   token type converted to string

## 0.53.0 (2020-08-19)

-   api tokens structire updated
-   bytesToUuid renamed to bufferToUuid
-   nginx conf tabs fixed

## 0.52.1 (2020-08-19)

-   webpack cache-control updated
-   nginx proxy add-modified-since header added
-   api handle token decode errors

## 0.52.0 (2020-08-18)

-   token encoded as base58
-   util toBase58, fromBase58 functions added
-   base-x deps added
-   encode default password to base64u
-   default password length set to 16 bytes

## 0.51.1 (2020-08-18)

-   allow to send event to the several threads at once

## 0.51.0 (2020-08-18)

-   allow to send event to multiple users at once
-   api getObjectUsers method added

## 0.50.0 (2020-08-17)

-   deps updated
-   threads return 404 in thread not found
-   namesilo api updated

## 0.49.0 (2020-08-17)

-   namesilo api
-   http/fetch duplicate statusText in reason property
-   api user object id renamed to guid
-   http agent tls servername added
-   ip-addr refactored
-   status codes updated

## 0.48.5 (2020-08-15)

-   proxy server authentication

## 0.48.4 (2020-08-15)

-   proxy server check connection type before connect to upstream proxy
-   node-fetch wrapper added

## 0.48.3 (2020-08-15)

-   proxy server refactored
-   proxy socket error handlers
-   util readLine params changed

## 0.48.2 (2020-08-14)

-   proxy server socks5 connection protocol updated

## 0.48.1 (2020-08-13)

-   proxy server refactored
-   https proxy refactored
-   http proxy refactored

## 0.48.0 (2020-08-13)

-   ip-addr subnet cidr mask fixed
-   proxies added
-   server moved to http/server
-   typo in dockerfile
-   util readChunk function added

## 0.47.1 (2020-08-08)

-   api validate email regexp updated
-   api username length expanded to 255 chars

## 0.47.0 (2020-08-08)

-   electron updates app mixin

## 0.46.0 (2020-08-08)

-   app env substitute vars

## 0.45.3 (2020-08-07)

-   .eslintrc.yaml removed
-   api schema skipParamsValidation -> noParamsValidation

## 0.45.2 (2020-08-05)

-   shrinkwrap updated

## 0.45.1 (2020-08-03)

-   deps updated
-   shrinkwrap added
-   chain proxy server class added
-   api class template updated

## 0.45.0 (2020-08-02)

-   docs yaml dump settings updated
-   docs multiline yaml fixed
-   wiki markdown links fixed for bitbucket
-   api signin method docs updated
-   chrome removed in favour of puppeteer

## 0.44.3 (2020-07-31)

-   nginx vhost renamed to vhosts
-   engines added to package.json

## 0.44.2 (2020-07-30)

-   docker file updated
-   docker remove cached node
-   docker pre-build urls updated

## 0.44.1 (2020-07-25)

-   npm prebuild binary hosts added
-   npm git links changed to git+https

## 0.44.0 (2020-07-22)

-   api auth_hash table renamed to user_hash
-   settings smtp from field added

## 0.43.1 (2020-07-21)

-   upsert user auth hash

## 0.43.0 (2020-07-21)

-   session signin statuses added
-   doc block parser fixed
-   fs.config.write fixed

## 0.42.1 (2020-07-21)

-   signin permissions renamed

## 0.42.0 (2020-07-21)

-   api session/signin added possibility to check user permissions on sign in

## 0.41.0 (2020-07-21)

-   server memory cache removed
-   loadbalancer config updated
-   app.listen renamed to app.\_listen

## 0.40.0 (2020-07-20)

-   unlink tmp on process exit

## 0.39.0 (2020-07-20)

-   docs fixed
-   ip-addr class added

## 0.38.0 (2020-07-19)

-   chrome api prototype
-   cloudflare cidrs added
-   getRealIP method added
-   nginx loadbalancer config updated
-   cache-control fixed for proxies
-   api client "persistent" replaced with "onDemand"
-   api "ping" message type added

## 0.37.0 (2020-07-18)

-   dockerfile updated
-   project location in docker renamed to /var/local/dist

## 0.36.0 (2020-07-18)

-   util getRandomFreePort, portIsFree functions added
-   ejs sync render
-   nginx loadbalancer config added

## 0.35.0 (2020-07-17)

-   UserName -> Username
-   userName -> username
-   lint patterns updated

## 0.34.0 (2020-07-16)

-   ansi colors added

## 0.33.4 (2020-07-16)

-   docs fixed

## 0.33.3 (2020-07-16)

-   user_name -> username

## 0.33.2 (2020-07-15)

-   wiki generator fixed

## 0.33.1 (2020-07-15)

-   wiki generator fixed

## 0.33.0 (2020-07-15)

-   docs generator
-   file tree isEmpty() method added
-   cli help fixed
-   docs fixed
-   confirm prompt fixed
-   changelog format updated

## 0.32.2 (2020-07-12)

-   .eslintrc.yaml updated

## 0.32.1 (2020-07-11)

-   docker clean dnf cache

## 0.32.0 (2020-07-10)

-   mime refactored
-   lint config added to package.json
-   readTree replaced with glob
-   cli allow - and -- arguments
-   cli option required fixed

## 0.31.0 (2020-07-08)

-   fs.tmp.dir added
-   .docker.yaml added

## 0.30.0 (2020-07-08)

-   cli boolean options refactored
-   code cleanup

## 0.29.0 (2020-07-07)

-   utils confirm functions added
