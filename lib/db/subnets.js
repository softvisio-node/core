const IPAddr = require( "../ip/addr" );
const IPSubnet = require( "../ip/subnet" );

const SUBNETS = {};

class Subnets {
    get ( name ) {
        return SUBNETS[name];
    }

    add ( name, subnet ) {
        subnet = IPSubnet.new( subnet );

        if ( !SUBNETS[name] ) SUBNETS[name] = [];

        SUBNETS[name].push( subnet );
    }

    remove ( name ) {
        delete SUBNETS[name];
    }

    contains ( name, addr ) {
        const subnets = SUBNETS[name];

        if ( !subnets ) return;

        addr = IPAddr.new( addr );

        for ( const subnet of subnets ) {
            if ( subnet.contains( addr ) ) return subnet;
        }
    }
}

const subnets = new Subnets();

module.exports = subnets;

const fs = require( "../fs" );
const DATA = fs.config.read( "#resources/subnets.yaml", { "resolve": __filename } );

for ( const name in DATA ) {
    for ( const cidr of DATA[name] ) {
        subnets.add( name, cidr );
    }
}
