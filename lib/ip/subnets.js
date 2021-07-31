import IPPool from "#lib/ip/pool";
import * as config from "#lib/config";

const SUBNETS = {};

class Subnets {
    getRange ( name ) {
        return SUBNETS[name];
    }

    addRange ( name, range ) {
        if ( !SUBNETS[name] ) SUBNETS[name] = new IPPool();

        SUBNETS[name].addRange( range );
    }

    removeRange ( name ) {
        delete SUBNETS[name];
    }

    contains ( name, range ) {
        const pool = SUBNETS[name];

        if ( !pool ) return;

        return pool.contains( range );
    }
}

const subnets = new Subnets();

export default subnets;

const DATA = config.read( "#resources/subnets.yaml", { "resolve": import.meta.url } );

for ( const name in DATA ) {
    for ( const range of DATA[name] ) {
        subnets.addRange( name, range );
    }
}
