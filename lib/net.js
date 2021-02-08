const net = require( "net" );

module.exports = net;

net.getRandomFreePort = async function ( host ) {
    return new Promise( resolve => {
        const srv = this.createServer( sock => sock.end() );

        srv.listen( 0, host, () => {
            const port = srv.address().port;

            srv.close();

            resolve( port );
        } );
    } );
};

net.portIsFree = async function ( port, ip ) {
    return new Promise( resolve => {
        const socket = new this.Socket();

        const cleanup = function () {
            socket.removeAllListeners();
            socket.end();
            socket.destroy();
            socket.unref();
        };

        socket.once( "connect", () => {
            cleanup();

            // port is busy
            resolve( false );
        } );

        socket.once( "error", e => {
            cleanup();

            // port is free
            if ( e.code === "ECONNREFUSED" ) {
                resolve( true );
            }

            // error
            else {
                resolve( false );
            }
        } );

        socket.connect( { "port": port, "host": ip }, function () {} );
    } );
};
