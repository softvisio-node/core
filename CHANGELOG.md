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
