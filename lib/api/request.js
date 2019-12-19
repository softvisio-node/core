export default class softvisioApiRequest {
    #api = null;

    #tid = null;

    #connId = null;

    #respond = null;

    constructor ( api, tid, connId ) {
        this.#api = api;
        this.#tid = tid;
        this.#connId = connId;
    }

    response () {
        if ( this.#tid && this.#connId === this.#api.connId ) {
            if ( this.#respond ) return;

            this.#respond = 1;

            const msg = {
                "type": "rpc",
                "tid": this.#tid,
            };

            if ( arguments.length > 2 ) {
                msg.result = { ...arguments[2] };

                msg.result.data = arguments[1];
            }
            else if ( arguments.length === 2 ) {
                msg.result.data = arguments[1];
            }


            if ( Array.isArray( arguments[0] ) ) {
                msg.result.status = arguments[0][0];

                msg.result.reason = arguments[0][1];
            }
            else {
                msg.result.status = arguments[0];
            }


            if ( !msg.result.reason ) msg.result.reason = "Unknown Reason";

            this.#api._send( msg );
        }
    }
}
