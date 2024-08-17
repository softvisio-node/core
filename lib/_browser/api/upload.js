import Events from "#lib/events";
import Signal from "#lib/threads/signal";
import result from "#lib/result";

const STATUS_NEW = 0;
const STATUS_STARTED = 1;
const STATUS_ABORTED = 10;
const STATUS_OK = 11;
const STATUS_ERROR = 12;

const STATUS = {
    [ STATUS_NEW ]: "Waiting",
    [ STATUS_STARTED ]: "Uploading",
    [ STATUS_ABORTED ]: "Aborted",
    [ STATUS_OK ]: "Finished",
    [ STATUS_ERROR ]: "Error",
};

export default class Upload extends Events {
    #api;
    #method;
    #abortController = new AbortController();
    #abortSignal;

    #status = STATUS_NEW;

    #signal = new Signal();
    #result;

    #loaded = 0;
    #progress = 0;
    #progressText; // eslint-disable-line no-unused-private-class-members

    constructor ( api, method, signal ) {
        super();

        this.#api = api;
        this.#method = method;

        if ( signal ) {
            this.#abortSignal = AbortSignal.any( [ this.#abortController.signal, signal ] );
        }
        else {
            this.#abortSignal = this.#abortController.signal;
        }
    }

    // properties
    get api () {
        return this.#api;
    }

    get abortSignal () {
        return this.#abortSignal;
    }

    get statusText () {
        return STATUS[ this.#status ];
    }

    get result () {
        return this.#result;
    }

    get isNew () {
        return this.#status === STATUS_NEW;
    }

    get isStarted () {
        return this.#status === STATUS_STARTED;
    }

    get isAborted () {
        if ( !this.isFinished ) return null;

        return this.#status === STATUS_ABORTED;
    }

    get isOk () {
        if ( !this.isFinished ) return null;

        return this.#status === STATUS_OK;
    }

    get isError () {
        if ( !this.isFinished ) return null;

        return this.#status === STATUS_ERROR;
    }

    get isFinished () {
        return this.#status > STATUS_STARTED;
    }

    get loaded () {
        return this.#loaded;
    }

    get progress () {
        if ( this.#progress == null ) this.#progress = this.#loaded / this.size;

        return this.#progress;
    }

    get progressText () {
        var text = `${ this.statusText } - ${ Math.floor( this.progress * 100 ) }%`;

        return text;
    }

    // public
    async start () {
        if ( this.isFinished ) return this.#result;

        if ( !this.isStarted ) {
            this.#setStatus( STATUS_STARTED );

            var url;

            // add api version to the method
            if ( !this.#method.startsWith( "/" ) ) {
                url = this.#api.uploadUrl.href + `v${ this.#api.version }/${ this.#method }`;
            }
            else {
                url = this.#api.uploadUrl.href + this.#method.substring( 1 );
            }

            this._start( url );
        }

        return this.#signal.wait();
    }

    abort () {
        if ( this.isFinished ) return;

        this.#abortController.abort();

        this.#result = result( [ 400, `Aborted` ] );

        this.#setStatus( STATUS_ABORTED );
    }

    // protected
    _setResult ( res ) {
        if ( this.isFinished ) return;

        this.#result = res;

        this.#setStatus( res.ok ? STATUS_OK : STATUS_ERROR );
    }

    _setProgress ( loaded ) {
        if ( loaded == null || loaded === this.#loaded ) return;

        this.#loaded = loaded;
        this.#progress = null;

        this.#updated();
    }

    // private
    #setStatus ( status ) {
        if ( this.#status === status ) return;

        this.#status = status;

        this.#updated();

        if ( this.isFinished ) {

            // clear events listeners
            this.offAll();

            this.#signal.broadcast( this.#result );
        }
    }

    #updated () {
        this.#progressText = null;

        this.emit( "progress", this );
    }
}
