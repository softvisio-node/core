const { objectIsIpAddr, objectIsSubnet } = require( "../util" );
const IPAddr = require( "../ip-addr" );
const Subnet = require( "../ip-addr/subnet" );

const SUBNETS = {};

class Subnets {
    get ( name ) {
        return SUBNETS[name];
    }

    add ( name, subnet ) {
        if ( !objectIsSubnet( subnet ) ) subnet = new Subnet( subnet );

        if ( !SUBNETS[name] ) SUBNETS[name] = [];

        SUBNETS[name].push( subnet );
    }

    remove ( name ) {
        delete SUBNETS[name];
    }

    contains ( name, addr ) {
        const subnets = SUBNETS[name];

        if ( !subnets ) return;

        if ( !objectIsIpAddr( addr ) ) addr = new IPAddr( addr );

        for ( const subnet of subnets ) {
            if ( subnet.contains( addr ) ) return subnet;
        }
    }
}

const subnets = new Subnets();

module.exports = subnets;

const fs = require( "../fs" );
const DATA = fs.config.read( __dirname + "/../../resources/subnets.yaml" );

for ( const name in DATA ) {
    for ( const cidr of DATA[name] ) {
        subnets.add( name, cidr );
    }
}
