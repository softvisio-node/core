module.exports = class Request {
    constructor ( api, tid, connId ) {
        // private
        this._api = api;
        this._tid = tid;
        this._connId = connId;
        this._respond = null;
    }

    response () {
        if ( this._tid && this._connId === this._api.connId ) {
            if ( this._respond ) return;

            this._respond = 1;

            const msg = {
                "type": "rpc",
                "tid": this._tid,
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

            this._api._send( msg );
        }
    }
};
