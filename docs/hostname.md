# Hostname

Class, representing hostname.

```javascript
import Hostname from "@c0rejs/core/hostname";

const hostname = new Hostname( "www.google.com" );
```

### new Hostname( hostname )

- `hostname` {string} URL host name.

### hostname.unicode

- Returns: {string} Domain name in unicode or IP address.

### hostname.ascii

- Returns: {string} Punycode ASCII serialized domain name or IP address.

### hostname.isValid

- Returns: {boolean} `true` if domain name or IP address is valid.

### hostname.isDomain

- Returns: {boolean} `true` if host name is domain.

### hostname.isIP

- Returns: {boolean} `true` if host name IP address.

### hostname.isIPv4

- Returns: {boolean} `true` if host name is IP v4 address.

### hostname.isIPv6

- Returns: {boolean} `true` if host name is IP v6 address.

### hostname.isTLD

- Returns: {boolean} `true` if host name is `TLD`.

### hostname.tld

- Returns: {Hostname|null} Host name `TLD` or {null}.

### hostname.tldIsValid

- Returns: {boolean} `true` if `TLD` is registered IANA `TLD`.

### hostname.isPublicSuffix

- Returns: {boolean} `true` if host name is public suffix.

### hostname.publicSuffix

- Returns: {Hostname|null} Public suffix or `null`, if domain is not belongs to any public suffix.

A "public suffix" is one under which Internet users can (or historically could) directly register names. Some examples of public suffixes are `.com`, `.co.uk` and `pvt.k12.ma.us`.

It can be used to:

- Avoid privacy-damaging "supercookies" being set for high-level domain name suffixes (prohibited to set cookies, if domain is public suffix).
- Highlight the most important part of a domain name in the user interface.
- Accurately sort history entries by site.

### hostname.isRootDomain

- Returns: {boolean} `true` if hostname is root domain.

### hostname.rootDomain

- Returns: {Hostname|null} Root domain or `null`.

Root domain is a minimal domain name, that can be registered.

### hostname.rootLabel

- Returns: {Hostname|null} First label of the root domain or `null`.

### hostname.toString()

- Returns: {string} Host name in unicode.

### hostname.toJSON()

- Returns: {string} Host name in unicode.
