export default class TelegeamBotContext {
    #bot;
    #module;
    #req;
    #user;
    #newUser;

    constructor ( bot, { module, req, user, newUser } = {} ) {
        this.#bot = bot;
        this.#module = module;
        this.#req = req;
        this.#user = user;
        this.#newUser = newUser;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get isAborted () {
        return this.#req.isAborted;
    }

    get module () {
        return this.#module;
    }

    get req () {
        return this.#req;
    }

    get user () {
        return this.#user;
    }

    get isNewUser () {
        return this.#newUser;
    }

    get state () {
        return this.#user.state.modules?.[this.module] || {};
    }

    // public
    async updateState ( state ) {
        return this.#user.updateState( {
            "modules": {
                [this.#module]: state,
            },
        } );
    }

    async runModule ( module, req ) {
        if ( this.module === module ) return result( 200 );

        var moduleInstance = this.#bot.getModuleInstance( module );

        // module not found
        if ( !moduleInstance ) {
            module = "/";

            moduleInstance = this.#bot.getModuleInstance( module );
        }

        const res = await this.user.updateState( { module } );
        if ( !res.ok ) return res;

        const ctx = new TelegeamBotContext( this.bot, {
            module,
            "req": this.#req,
            "user": this.#user,
            "newUser": this.#newUser,
        } );

        return moduleInstance.run( ctx, req );
    }
}
