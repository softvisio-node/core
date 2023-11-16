export default class TelegeamBotContext {
    #bot;
    #req;
    #user;
    #module;

    constructor ( bot, user, req, { module } = {} ) {
        this.#bot = bot;
        this.#req = req;
        this.#user = user;
        this.#module = module;
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

    get userModule () {
        return this.user.state.module;
    }

    get module () {
        return this.#module || this.userModule;
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
        var moduleInstance = this.#bot.getModuleInstance( module );

        // module not found
        if ( !moduleInstance ) {
            module = "/start";

            moduleInstance = this.#bot.getModuleInstance( module );
        }

        // update current module
        if ( module !== this.userModule ) {
            const currentModule = this.bot.getModuleInstance( this.userModule );

            // exit current module
            if ( currentModule ) {
                await currentModule.onModuleExit();
            }

            const res = await this.user.updateState( { module } );
            if ( !res.ok ) return res;
        }

        const ctx = new TelegeamBotContext( this.#bot, this.#user, this.#req );

        return moduleInstance.run( ctx, req );
    }
}
