import IPAddr from "#lib/ip/addr";
import IPSubnet from "#lib/ip/subnet";
import fs from "#lib/fs";

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

export default subnets;

const DATA = fs.config.read( "#resources/subnets.yaml", { "resolve": import.meta.url } );

for ( const name in DATA ) {
    for ( const cidr of DATA[name] ) {
        subnets.add( name, cidr );
    }
}
