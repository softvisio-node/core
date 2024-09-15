import net from "node:net";

export default net;
export * from "node:net";

const DEFAULT_PORTS = {
    "ftp:": 21,
    "ftps:": 990,
    "gopher:": 70,
    "http:": 80,
    "https:": 443,
    "ws:": 80,
    "wss:": 443,
    "postgresql:": 5432,
    "postgresql+tls:": 5432,
    "redis:": 6379,
    "redis+tls:": 6379,
    "smtp:": 25,
    "smtp+tls:": 465,
    "smtp+starttls:": 587,
    "ssh:": 22,
};

export function getDefaultPort ( protocol ) {
    return DEFAULT_PORTS[ protocol ];
}

export async function getRandomFreePort ( host ) {
    host ||= "127.0.0.1";

    return new Promise( resolve => {
        const srv = net.createServer( sock => sock.end() );

        srv.listen( 0, host, () => {
            const port = srv.address().port;

            srv.close();

            resolve( port );
        } );
    } );
}

export async function portIsFree ( port, host ) {
    host ||= "127.0.0.1";

    return new Promise( resolve => {
        const socket = new net.Socket();

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

        socket.connect(
            {
                port,
                host,
            },
            function () {}
        );
    } );
}

export async function connect ( { tls, checkCertificate = true, connectTimeout, ...options } = {}, onConnect ) {
    if ( tls ) {
        ( { "default": tls } = await import( "node:tls" ) );

        options.rejectUnauthorized = !!checkCertificate;
    }

    var socket, error, timeout, callback;

    if ( connectTimeout ) {
        timeout = setTimeout( () => socket.destroy( "Connection timeout" ), connectTimeout );
    }

    await new Promise( ( resolve, reject ) => {
        callback = e => {

            // connection error
            if ( e ) {
                reject( e );
            }

            // connected
            else {
                resolve();
            }
        };

        if ( tls ) {
            socket = tls.connect( options, callback );
        }
        else {
            socket = net.connect( options, callback );
        }

        socket.once( "error", callback );
    } ).catch( e => {
        error = e;
    } );

    socket.off( "error", callback );
    socket.off( tls
        ? "secureConnect"
        : "connect", callback );

    if ( error ) throw error;

    if ( socket.destroyed ) throw "Connection closed";

    if ( onConnect ) {
        callback = e => {
            error = e;
        };

        socket.once( "error", callback );

        try {
            await onConnect( socket );
        }
        catch ( e ) {
            error = e;

            socket.destroy();
        }

        socket.off( "error", callback );
    }

    clearTimeout( timeout );

    if ( error ) throw error;

    if ( socket.destroyed ) throw "Connection closed";

    return socket;
}

net.getDefaultPort = getDefaultPort;
net.getRandomFreePort = getRandomFreePort;
net.portIsFree = portIsFree;
