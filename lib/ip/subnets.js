import IpRangeSet from "#lib/ip/range-set";
import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Events from "#lib/events";

class IpSubnets extends Events {
    #subnets = {};
    #subnetsUpdateListeners = {};

    // public
    has ( name ) {
        return !!this.#subnets[ name ];
    }

    get ( name ) {
        return this.#subnets[ name ];
    }

    add ( name, ranges ) {
        if ( !this.#subnets[ name ] ) {
            this.#subnets[ name ] = new IpRangeSet( ranges );

            this.#subnets[ name ].on( "update", ( this.#subnetsUpdateListeners[ name ] = this.#onSubnetUpdate.bind( this, name ) ) );

            this.emit( "add", name );
        }
        else {
            this.#subnets[ name ].add( ranges );
        }

        return this;
    }

    set ( name, ranges ) {
        if ( this.#subnets[ name ] ) {
            this.#subnets[ name ].set( ranges );
        }
        else {
            this.add( name, ranges );
        }

        return this;
    }

    delete ( name ) {
        if ( this.#subnets[ name ] ) {
            this.#subnets[ name ].off( "update", this.#subnetsUpdateListeners[ name ] );

            delete this.#subnetsUpdateListeners[ name ];

            delete this.#subnets[ name ];

            this.emit( "delete", name );
        }

        return this;
    }

    // private
    #onSubnetUpdate ( name ) {
        this.emit( "update", name );
    }
}

const subnets = new IpSubnets();

export default subnets;

const resource = await externalResources.add( "softvisio-node/core/resources/subnets" ).on( "update", loadResources ).check();

loadResources();

function loadResources () {
    const data = readConfig( resource.location + "/subnets.json" );

    for ( const name in data ) {
        subnets.set( name, data[ name ] );
    }
}
