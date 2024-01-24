class CallSite {
    #callSite;

    constructor ( callSite ) {
        this.#callSite = callSite;
    }

    // properties
    get columnNumber () {
        return this.#callSite.getColumnNumber();
    }

    get evalOrigin () {
        return this.#callSite.getEvalOrigin();
    }

    get fileName () {
        return this.#callSite.getFileName();
    }

    get function () {
        return this.#callSite.getFunction();
    }

    get functionName () {
        return this.#callSite.getFunctionName();
    }

    get lineNumber () {
        return this.#callSite.getLineNumber();
    }

    get methodName () {
        return this.#callSite.getMethodName();
    }

    get getThis () {
        return this.#callSite.getThis();
    }

    get typeName () {
        return this.#callSite.getTypeName();
    }

    get isConstructor () {
        return this.#callSite.isConstructor();
    }

    get isEval () {
        return this.#callSite.isEval();
    }

    get isNative () {
        return this.#callSite.isNative();
    }

    get isTopLevel () {
        return this.#callSite.isToplevel();
    }

    // public
    toString () {
        return this.#callSite.toString();
    }
}

class CallStack {
    #stack;
    #topLevel;
    #toString;

    constructor ( stack ) {
        this.#stack = stack.map( callSite => new CallSite( callSite ) );
    }

    // properties
    get topLevel () {
        if ( !this.#topLevel ) {
            for ( let n = this.#stack.length - 1; n >= 0; n-- ) {
                if ( this.#stack[ n ].fileName.startsWith( "node:" ) ) continue;

                this.#topLevel = this.#stack[ n ];

                break;
            }
        }

        return this.#topLevel;
    }

    // public
    get size () {
        return this.#stack.length;
    }

    get ( idx ) {
        return this.#stack[ idx ];
    }

    *[ Symbol.iterator ] () {
        for ( let n = 0; n < this.#stack.length; n++ ) {
            yield this.#stack[ n ];
        }
    }

    toString () {
        this.#toString ??= this.#stack.join( "\n" );

        return this.#toString;
    }
}

class Call {
    stack ( depth ) {
        const stackTraceLimit = Error.stackTraceLimit,
            prepareStackTrace = Error.prepareStackTrace;

        Error.stackTraceLimit = depth || Infinity;

        Error.prepareStackTrace = function ( trace, callSite ) {
            return callSite;
        };

        const trace = {};

        Error.captureStackTrace( trace, this.stack );

        const stack = trace.stack;

        Error.stackTraceLimit = stackTraceLimit;
        Error.prepareStackTrace = prepareStackTrace;

        return new CallStack( stack );
    }

    caller ( idx ) {
        idx ||= 0;
        idx += 2;

        const stack = this.stack( idx + 1 );

        return stack.get( idx );
    }
}

export default new Call();
