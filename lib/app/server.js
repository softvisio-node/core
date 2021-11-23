import HttpServer from "#lib/http/server";

const DEFAULT_ADDR = "0.0.0.0";
const DEFAULT_PORT = 80;

export default class Server extends HttpServer {

    // public
    async listen ( addr, port ) {
        addr ||= DEFAULT_ADDR;
        port ||= DEFAULT_PORT;

        process.stdout.write( `Starting HTTP server ... ` );

        const res = await super.listen( addr, port );

        if ( res.ok ) console.log( `listening on ${addr}:${port}` );
        else console.log( `unable bind to the ${addr}:${port}` );

        return res;
    }
}
