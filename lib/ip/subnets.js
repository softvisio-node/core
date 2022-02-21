import IpPool from "#lib/ip/pool";
import { readConfig } from "#lib/config";
import resources from "#lib/resources/core";

const SUBNETS = {};

class Subnets {
    getSubnet ( name ) {
        return SUBNETS[name];
    }

    deleteSubnet ( name ) {
        delete SUBNETS[name];
    }

    addRange ( name, range ) {
        if ( !SUBNETS[name] ) SUBNETS[name] = new IpPool();

        SUBNETS[name].addRange( range );
    }

    contains ( name, range ) {
        const pool = SUBNETS[name];

        if ( !pool ) return;

        return pool.contains( range );
    }
}

const subnets = new Subnets();

export default subnets;

resources.on( "update", id => loadResources( id ) ).startUpdate();

loadResources();

function loadResources ( id ) {
    if ( id && id !== "subnets" ) return;

    const data = readConfig( resources.location + "/" + resources.get( "subnets" ).files[0] );

    for ( const name in data ) {
        subnets.deleteSubnet( name );

        for ( const range of data[name] ) {
            subnets.addRange( name, range );
        }
    }
}
