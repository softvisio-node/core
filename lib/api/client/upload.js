import Events from "#lib/events";
import Mutex from "#lib/threads/mutex";
import result from "#lib/result";

const STATUS_NEW = 0;
const STATUS_STARTED = 1;
const STATUS_ABORTED = 2;
const STATUS_FINISHED = 3;

const STATUS = {
    [STATUS_NEW]: "Waiting",
    [STATUS_STARTED]: "Uploading",
    [STATUS_ABORTED]: "Finished",
    [STATUS_FINISHED]: "Aborted",
};

export default class Upload extends Events {
    #api;
    #method;

    #status = STATUS_NEW;

    #mutex = new Mutex();
    #result;

    #bytesSent = 0;
    #progress = 0;
    #progressText;

    constructor ( api, method, onProgress ) {
        super();

        this.#api = api;
        this.#method = method;

        if ( onProgress ) this.on( "progress", onProgress );
    }

    get statusText () {
        return STATUS[this.#status];
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
        return this.#status === STATUS_ABORTED;
    }

    get isFinished () {
        return this.isAborted() || this.#status === STATUS_FINISHED;
    }

    get bytesSent () {
        return this.#bytesSent;
    }

    get progress () {
        if ( this.#progress == null ) this.#progress = this.#bytesSent / this.size;

        return this.#progress;
    }

    // XXX
    get progressText () {
        var text = this.statusText;

        return text;
    }

    // public
    async start () {
        if ( this.isFinished ) return this.#result;

        // already started
        if ( this.#mutex.tryDown() ) {
            this.#setStatus( STATUS_STARTED );

            this._start( this.#api, this.#method );
        }

        return this.#mutex.signal.wait();
    }

    abort () {
        if ( this.isFinished ) return;

        if ( this._abort() ) {
            this.#result = result( [400, `Aborted`] );

            this.#setStatus( STATUS_ABORTED );

            return true;
        }
        else {
            return false;
        }
    }

    // protected
    _setResult ( res ) {
        if ( this.isFinished ) return;

        this.#result = res;

        this.#setStatus( STATUS_FINISHED );
    }

    _setProgress ( bytesSent ) {
        if ( bytesSent == null || bytesSent === this.#bytesSent ) return;

        this.#bytesSent = bytesSent;
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
            this.removeAllListeners();

            this.#mutex.signal.broadcast( this.#result );
        }
    }

    #updated () {
        this.#progressText = null;

        this.emit( "progress", this );
    }
}
