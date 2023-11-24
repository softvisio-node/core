export default class TelegramBotContext {
    #bot;
    #req;
    #user;
    #module;
    #newUser;

    constructor ( bot, user, req, { module, newUser } = {} ) {
        this.#bot = bot;
        this.#req = req;
        this.#user = user;
        this.#module = module;
        this.#newUser = !!newUser;
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

    get isNewUser () {
        return this.#newUser;
    }

    get module () {
        return this.#module;
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

    async call ( module, req ) {
        module ||= this.#userModule;

        // check redirect
        const redirectModule = await this.#bot.modules.get( "start" ).redirectCall( this.#clone( "start" ) );

        // redirected
        if ( redirectModule ) {
            if ( redirectModule !== module ) req = null;

            module = redirectModule;
        }

        var moduleInstance = this.#bot.modules.get( module );

        // module not found
        if ( !moduleInstance ) {
            module = "start";
            req = null;

            moduleInstance = this.#bot.modules.get( module );
        }

        // update current module
        if ( module !== this.#userModule ) {
            const currentModuleInstance = this.bot.modules.get( this.#userModule );

            // exit current module
            if ( currentModuleInstance ) {
                const ctx = this.#clone( this.#userModule );

                await currentModuleInstance.beforeExit( ctx );
            }

            const res = await this.user.updateState( { module } );
            if ( !res.ok ) return res;
        }

        const ctx = this.#clone( module );

        await moduleInstance.beforeRun( ctx, req );

        return moduleInstance.run( ctx, req );
    }

    async runCallback ( callbackData ) {
        const idx = callbackData.method.lastIndexOf( "/" );

        const module = callbackData.method.substring( 0, idx ),
            method = "API_" + callbackData.method.substring( idx + 1 );

        // module method os not found
        if ( typeof this.#bot.modules.get( module )?.[method] !== "function" ) return;

        // create context
        const ctx = this.#clone( module );

        try {
            return this.#bot.modules.get( module )[method]( ctx, ...callbackData.args );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true } );
        }
    }

    createWebAooUrl ( data ) {
        const webAppUrl = this.bot.telegram.config.webAppUrl;

        if ( !webAppUrl ) return;

        const url = new URL( webAppUrl );

        url.searchParams.set( "locale", this.#user.locale );

        data = JSON.stringify( {
            "botId": this.bot.id,
            "botType": this.bot.type,
            data,
        } );

        const params = new URLSearchParams();
        params.set( "data", data );

        url.hash = "/telegram-webapp?" + params.toString();

        return url.href;
    }

    // private
    get #userModule () {
        return this.#user.state.module;
    }

    #clone ( module ) {
        if ( module === this.#module ) return this;

        return new TelegramBotContext( this.#bot, this.#user, this.#req, {
            "newUser": this.#newUser,
            module,
        } );
    }
}
