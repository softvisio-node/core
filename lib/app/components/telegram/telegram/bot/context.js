export default class TelegramBotContext {
    #bot;
    #req;
    #user;
    #permissions;
    #command;
    #newUser;
    #state;

    constructor ( { bot, command, user, permissions, newUser, req } = {} ) {
        this.#bot = bot;
        this.#req = req;
        this.#user = user;
        this.#permissions = permissions;
        this.#command = command;
        this.#newUser = !!newUser;
    }

    // properties
    get app () {
        return this.#bot.app;
    }

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

    get permissions () {
        return this.#permissions;
    }

    get isNewUser () {
        return this.#newUser;
    }

    get command () {
        return this.#command;
    }

    get state () {
        this.#state ||= this.#user.state.commands?.[ this.#command ] || {};

        return this.#state;
    }

    // public
    async updateState ( state, { dbh } = {} ) {
        return this.#user.updateState(
            {
                "commands": {
                    [ this.command ]: state,
                },
            },
            { dbh }
        );
    }

    async clearState ( { dbh } = {} ) {
        return this.#user.updateState(
            {
                "commands": {
                    [ this.command ]: undefined,
                },
            },
            { dbh }
        );
    }

    async run ( command, req ) {
        command ||= this.#userCommand;

        // check redirect
        const redirectCommand = await this.#bot.commands.get( "start" ).redirectCall( this.#clone( "start" ) );

        // redirected
        if ( redirectCommand ) {
            if ( redirectCommand !== command ) req = null;

            command = redirectCommand;
        }

        var commandInstance = this.#bot.commands.get( command );

        // check command permissions
        if ( !commandInstance?.checkPermissions( this ) ) commandInstance = null;

        // command not found
        if ( !commandInstance ) {
            command = "start";
            req = null;

            commandInstance = this.#bot.commands.get( command );
        }

        // update current command
        if ( command !== this.#userCommand ) {
            const currentCommandInstance = this.bot.commands.get( this.#userCommand );

            // exit current command
            if ( currentCommandInstance ) {
                const ctx = this.#clone( this.#userCommand );

                await currentCommandInstance.beforeExit( ctx );
            }

            const res = await this.user.updateState( { command } );
            if ( !res.ok ) return res;
        }

        const ctx = this.#clone( command );

        await commandInstance.beforeRun( ctx, req );

        return commandInstance.run( ctx, req );
    }

    async runCallback ( callbackData ) {
        var [ method, ...args ] = callbackData;

        const idx = method.lastIndexOf( "/" );

        const commandInstance = this.#bot.commands.get( method.substring( 0, idx ) );

        method = "API_" + method.substring( idx + 1 );

        // command method os not found
        if ( typeof commandInstance?.[ method ] !== "function" ) return;

        // check command permissions
        if ( !commandInstance.checkPermissions( this ) ) return;

        // create context
        const ctx = this.#clone( commandInstance.id );

        try {
            return commandInstance[ method ]( ctx, ...args );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async createWebAooUrl ( data ) {
        const webAppUrl = this.bot.telegram.config.webAppUrl;

        if ( !webAppUrl ) return;

        const url = new URL( webAppUrl );

        if ( this.#user.apiUserId ) {
            var user = await this.#user.getApiUser();

            if ( user ) {
                url.searchParams.set( "locale", user.locale );
            }
        }

        data = JSON.stringify( {
            "userId": user?.id,
            "telegramBotId": this.bot.id,
            "telegramBotType": this.bot.type,
            data,
        } );

        const searchParams = new URLSearchParams();

        searchParams.set( "data", data );

        url.hash = "/telegram-webapp?" + searchParams.toString();

        return url.href;
    }

    async send ( ...args ) {
        return this.#user.send( ...args );
    }

    async sendText ( ...args ) {
        return this.#user.sendText( ...args );
    }

    async sendMessage ( ...args ) {
        return this.#user.sendMessage( ...args );
    }

    async sendChatAction ( ...args ) {
        return this.#user.sendChatAction( ...args );
    }

    async sendDeleteMessage ( ...args ) {
        return this.#user.sendDeleteMessage( ...args );
    }

    // private
    get #userCommand () {
        return this.#user.state.command;
    }

    #clone ( command ) {
        if ( command === this.#command ) return this;

        return new TelegramBotContext( {
            "bot": this.#bot,
            command,
            "user": this.#user,
            "permissions": this.#permissions,
            "newUser": this.#newUser,
            "req": this.#req,
        } );
    }
}
