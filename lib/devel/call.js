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
    #stack = [];
    #top;

    constructor ( stack ) {
        this.#stack = stack.map( callSite => new CallSite( callSite ) );
    }

    // properties
    get top () {
        if ( !this.#top ) {
            for ( const callSite of this.#stack ) {
                if ( callSite.fileName.startsWith( "node:" ) ) continue;

                this.#top = callSite;

                break;
            }
        }

        return this.#top;
    }

    // public
    get ( idx ) {
        return this.#stack[idx];
    }
}

class Call {
    stack () {
        const stackTraceLimit = Error.stackTraceLimit,
            prepareStackTrace = Error.prepareStackTrace;

        Error.stackTraceLimit = Infinity;

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
        const stack = this.stack();

        idx ||= 0;

        return stack.get( idx + 2 );
    }
}

export default new Call();
