import IpRangeSet from "#lib/ip/range-set";
import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";

const SUBNETS = {};

class IpSubnets {

    // public
    add ( name ) {
        return ( SUBNETS[name] ||= new IpRangeSet() );
    }

    get ( name ) {
        return SUBNETS[name];
    }

    delete ( name ) {
        delete SUBNETS[name];

        return this;
    }
}

const subnets = new IpSubnets();

export default subnets;

const resource = externalResources.add( "softvisio-node/core/data/subnets", import.meta.url ).on( "update", loadResources );

loadResources();

function loadResources () {
    const data = readConfig( resource.location + "/subnets.json" );

    for ( const name in data ) {
        subnets.delete( name );

        const subnet = subnets.add( name );

        for ( const range of data[name] ) {
            subnet.add( range );
        }
    }
}
