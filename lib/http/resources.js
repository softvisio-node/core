import Resources from "#lib/resources";
import env from "#lib/env";

import Http from "#lib/http/resources/http";

export default new Resources( {
    "location": env.getXdgDataDir( "softvisio-core" ),
    "repo": "softvisio/core",
    "tag": "data",
    "updateInterval": 1000 * 60 * 60 * 24, // 24 hours
    "resources": [Http],
} );
