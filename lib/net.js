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
    "postgresql+ssl:": 5432,
    "redis:": 6379,
    "redis+ssl:": 6379,
    "smtp:": 25,
    "smtp+tls:": 465,
    "smtp+starttls:": 587,
    "ssh:": 22,
};

export function getDefaultPort ( protocol ) {
    return DEFAULT_PORTS[ protocol ];
}

export async function getRandomFreePort ( host ) {
    return new Promise( resolve => {
        const srv = net.createServer( sock => sock.end() );

        srv.listen( 0, host, () => {
            const port = srv.address().port;

            srv.close();

            resolve( port );
        } );
    } );
}

export async function portIsFree ( port, ip ) {
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

        socket.connect( { "port": port, "host": ip }, function () {} );
    } );
}

net.getDefaultPort = getDefaultPort;
net.getRandomFreePort = getRandomFreePort;
net.portIsFree = portIsFree;
