import IPPool from "#lib/ip/pool";
import fs from "#lib/fs";

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

const DATA = fs.config.read( "#assets/subnets.yaml", { "resolve": import.meta.url } );

for ( const name in DATA ) {
    for ( const range of DATA[name] ) {
        subnets.addRange( name, range );
    }
}
