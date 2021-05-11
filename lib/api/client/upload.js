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
    #data;

    #status;
    #isStarted;
    #isFinished;
    #isAborted;

    #mutex = new Mutex();
    #result;

    #bytesTotal = 0;
    #bytesSent = 0;
    #progress = 0;
    #progressText;

    constructor ( api, method, data, onProgress ) {
        super();

        this.#api = api;
        this.#method = method;
        this.#data = data;

        if ( onProgress ) this.on( "progress", onProgress );
    }

    get status () {
        return this.#status;
    }

    get result () {
        return this.#result;
    }

    get isNew () {
        return !this.#isStarted;
    }

    get isStarted () {
        return this.#isStarted;
    }

    get isFinished () {
        return this.#isFinished;
    }

    get isAborted () {
        return this.#isAborted;
    }

    get bytesTotal () {
        return this.#bytesTotal;
    }

    get bytesSent () {
        return this.#bytesSent;
    }

    get progress () {
        return this.#progress;
    }

    get progressText () {
        var text = this.status;

        return text;
    }

    // public
    // XXX clear listeners on finish
    async start () {
        if ( this.#isFinished ) return this.#result;

        if ( !this.#mutex.tryDown() ) return this.#mutex.signal.wait();

        this.isStarted = true;

        this.#result = await this._start( this.#api, this.#method, this.#data );

        this.#isFinished = true;

        this.#mutex.signal.broadcast( this.#result );

        this.#mutex.up();

        this.emit( "progress", this );

        return this.#result;
    }

    abort () {
        if ( this.#isFinished ) return;

        if ( !this.#isStarted ) {
            this.#isFinished = true;

            this.#result = result( [400, `Aborted`] );
        }
        else {
            this._abort();
        }

        this.emit( "progress", this );
    }

    // protected
    _setBytesTotal ( bytes ) {
        this.#bytesTotal = bytes;

        this.emit( "progress", this );
    }

    _setBytesSent ( bytes ) {
        this.#bytesSent = bytes;

        this.#progress = this.#bytesSent / this.#bytesTotal;

        this.emit( "progress", this );
    }

    // XXX
    _setResult ( res ) {
        STATUS;
    }

    // private
    // XXX
    #setStatus ( status, bytesSent ) {

        //
    }
}
