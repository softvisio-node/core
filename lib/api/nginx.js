const fs = require( "fs" );
const ejs = require( "ejs" );

const BASE_DIR = "/var/run/nginx";
const VHOSTS_DIR = BASE_DIR + "/vhost";

module.exports.installLoadBalancerConfig = async function ( id, port, hosts ) {
    const conf = await ejs.renderFile( __dirname + "/../../resources/tmpl/nginx/vhost-load-balancer.nginx.conf", { id, port, hosts } );

    fs.writeFileSync( VHOSTS_DIR + "/" + id + ".nginx.conf", conf );
};

module.exports.removeLoadBalancerConfig = function ( id ) {
    fs.unlinkFileSync( VHOSTS_DIR + "/" + id + ".nginx.conf" );
};
