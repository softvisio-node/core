import HTTPServer from "#lib/http/server";

export default class Server extends HTTPServer {

    // public
    publish () {}

    async listen ( addr, port ) {
        console.log( 11111 );

        const res = await super.listen( addr, port );

        if ( res.ok ) console.log( `Listening ... ${addr}:${port}` );
        else console.log( `Listening ... error listen ${addr}:${port}` );

        return res;
    }
}
