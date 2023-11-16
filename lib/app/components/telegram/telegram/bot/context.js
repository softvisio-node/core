export default class TelegeamBotContext {
    #bot;
    #req;
    #user;

    constructor ( bot, { req, user } = {} ) {
        this.#bot = bot;
        this.#req = req;
        this.#user = user;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get isAborted () {
        return this.#req.isAborted;
    }

    get req () {
        return this.#req;
    }

    get user () {
        return this.#user;
    }

    get module () {
        return this.user.state.module;
    }

    get state () {
        return this.#user.state.modules?.[this.module] || {};
    }

    // public
    async updateState ( state ) {
        return this.#user.updateState( {
            "modules": {
                [this.module]: state,
            },
        } );
    }

    async runModule ( module, req ) {
        module ||= "/";

        var moduleInstance = this.#bot.getModuleInstance( module );

        // module not found
        if ( !moduleInstance ) {
            module = "/";

            moduleInstance = this.#bot.getModuleInstance( module );
        }

        // update current module
        if ( module !== this.module ) {
            const currentModule = this.bot.getModule( this.module );

            // exit current module
            if ( currentModule ) {
                await currentModule.onModuleExit();
            }

            const res = await this.user.updateState( { module } );
            if ( !res.ok ) return res;
        }

        return moduleInstance.run( this, req );
    }
}
