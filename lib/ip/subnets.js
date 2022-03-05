import IpRangeSet from "#lib/ip/range-set";
import { readConfig } from "#lib/config";
import resources from "#lib/resources/core";

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

resources.on( "update", id => loadResources( id ) ).startUpdate();

loadResources();

function loadResources ( id ) {
    if ( id && id !== "subnets" ) return;

    const data = readConfig( resources.location + "/" + resources.get( "subnets" ).files[0] );

    for ( const name in data ) {
        subnets.delete( name );

        const subnet = subnets.add( name );

        for ( const range of data[name] ) {
            subnet.addRange( range );
        }
    }
}
