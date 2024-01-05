import IpRangeSet from "#lib/ip/range-set";
import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Events from "#lib/events";

class IpSubnets extends Events {
    #subnets = {};

    // public
    has ( name ) {
        return !!this.#subnets[name];
    }

    get ( name ) {
        return this.#subnets[name];
    }

    add ( name, ranges ) {
        if ( !this.#subnets[name] ) {
            this.#subnets[name] = new IpRangeSet( ranges );

            this.emit( "add", name );
        }

        return this.#subnets[name];
    }

    delete ( name ) {
        if ( this.#subnets[name] ) {
            delete this.#subnets[name];

            this.emit( "delete", name );
        }

        return this;
    }
}

const subnets = new IpSubnets();

export default subnets;

const resource = await externalResources.add( "softvisio-node/core/resources/subnets" ).on( "update", loadResources ).check();

loadResources();

// XXX
function loadResources () {
    const data = readConfig( resource.location + "/subnets.json" );

    for ( const name in data ) {
        subnets.delete( name );

        subnets.add( name, data[name] );
    }
}
