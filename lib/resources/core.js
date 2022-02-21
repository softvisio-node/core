import Resources from "#lib/resources";
import env from "#lib/env";

import Http from "#lib/resources/core/http";
import PublicSuffix from "#lib/resources/core/public-suffix";
import Tld from "#lib/resources/core/tld";
import Subnets from "#lib/resources/core/subnets";

export default new Resources( {
    "location": env.getXdgDataDir( "softvisio-core" ),
    "repository": "softvisio/core",
    "tag": "data",
    "updateInterval": 1000 * 60 * 60 * 24, // 24 hours
    "resources": [Http, PublicSuffix, Tld, Subnets],
} );
