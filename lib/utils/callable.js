module.exports = class Callable extends Function {
    constructor ( method ) {
        super( "...args", `return this.__self.${method}(...args)` );

        var self = this.bind( this );

        this.__self = self;

        /* eslint-disable-next-line */
        return self;
    }
};
