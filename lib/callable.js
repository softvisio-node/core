export default class Callable extends Function {
    constructor ( method ) {
        super();

        const self = new Proxy( this, {
            "apply": ( target, that, args ) => self[ method ]( ...args ),
        } );

        // eslint-disable-next-line no-constructor-return
        return self;
    }
}
