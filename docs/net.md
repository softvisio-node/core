# Net

```javascript
import * as net from "@softvisio/utils/net";
```

### net.getDefaultPort( protocol )

-   `protocol` <string\> URL protocol.
-   Returns: <integer\> Default port for the specified protocol.

Default ports:

| Protocol | Default port |
| -------- | -----------: |
| ftp:     |           21 |
| ftps:    |          990 |
| gopher:  |           70 |
| http:    |           80 |
| https:   |          443 |
| ws:      |           80 |
| wss:     |          443 |
| pgsql:   |         5432 |
| pgsqls:  |         5432 |
| redis:   |         6379 |
| rediss:  |         6379 |
| smtp:    |          587 |
| smtps:   |          465 |
| ssh:     |           22 |

### net.getRandomFreePort( hostname )

-   `hostname` <string\> IP address or host name.
-   Returns: `integer\` Fulfils with the random free port for the specified host name.

### net.portIsFree( port, hostname )

-   `port` <integer\> Port to check.
-   `hostname` <string\> IP address or host name to check port.
-   Returns: <Promise\> Fulfils with the <boolean\> `true` if port is not used.
