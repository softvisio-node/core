import HttpServer from "#lib/http/server";

const DEFAULT_ADDR = "0.0.0.0";
const DEFAULT_PORT = 80;

export default class Server extends HttpServer {

    // public
    async listen ( addr, port ) {
        addr ||= DEFAULT_ADDR;
        port ||= DEFAULT_PORT;

        const res = await super.listen( addr, port );

        if ( res.ok ) console.log( `Listening ... ${addr}:${port}` );
        else console.log( `Listening ... error listen ${addr}:${port}` );

        return res;
    }
}
