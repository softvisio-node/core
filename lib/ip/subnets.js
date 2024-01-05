import IpRangeSet from "#lib/ip/range-set";
import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Events from "#lib/events";

const SUBNETS = {};

class IpSubnets extends Events {

    // public
    add ( name, ranges ) {
        return ( SUBNETS[name] ||= new IpRangeSet( ranges ) );
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

const resource = await externalResources.add( "softvisio-node/core/resources/subnets" ).on( "update", loadResources ).check();

loadResources();

function loadResources () {
    const data = readConfig( resource.location + "/subnets.json" );

    for ( const name in data ) {
        subnets.delete( name );

        subnets.add( name, data[name] );
    }
}
