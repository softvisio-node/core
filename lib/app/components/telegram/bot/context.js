import Command from "./command.js";

export default class TelegramBotContext {
    #bot;
    #req;
    #user;
    #grouo;
    #channel;
    #permissions;
    #command;
    #newUser;

    constructor ( { bot, command, user, grouo, channel, permissions, newUser, req } = {} ) {
        this.#bot = bot;
        this.#req = req;
        this.#user = user;
        this.#grouo = grouo;
        this.$channel = channel;
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

    get grouo () {
        return this.#grouo;
    }

    get channel () {
        return this.#channel;
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
        return this.#user.state?.commands?.[ this.#command ];
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

    isCommandEnabled ( command ) {
        if ( !command ) return false;

        if ( typeof command === "string" ) {
            command = this.#bot.commands.get( command );

            if ( !command ) return false;
        }

        if ( command.id === "start" ) return true;

        return command.isEnabled( this );
    }

    async run ( command, requestMessage ) {
        if ( !command ) {
            command = this.#userCommand;
        }
        else if ( command instanceof Command ) {
            command = command?.id;
        }

        command ||= this.#userCommand || "start";

        // check redirect
        const redirectCommand = await this.#bot.commands.get( "start" ).redirectCall( this.#clone( "start" ) );

        // redirected
        if ( redirectCommand ) {
            if ( redirectCommand !== command ) requestMessage = null;

            command = redirectCommand;
        }

        var commandInstance = this.#bot.commands.get( command );

        // check command permissions
        if ( !this.isCommandEnabled( commandInstance ) ) commandInstance = null;

        // command not found
        if ( !commandInstance ) {
            commandInstance = this.#bot.commands.get( "start" );

            requestMessage = null;
        }

        // update current command
        if ( commandInstance.id !== this.#userCommand ) {
            const currentCommandInstance = this.bot.commands.get( this.#userCommand );

            // exit current command
            if ( currentCommandInstance ) {
                const ctx = this.#clone( this.#userCommand );

                await currentCommandInstance.beforeExit( ctx );
            }

            // update user command
            const res = await this.user.updateState( { "command": commandInstance.id } );
            if ( !res.ok ) return res;
        }

        const ctx = this.#clone( commandInstance.id );

        await commandInstance.beforeRun( ctx, requestMessage );

        return commandInstance.run( ctx, requestMessage );
    }

    async runCallback ( method, ...args ) {
        var command;

        if ( method.includes( "/" ) ) {
            [ command, method ] = method.split( "/" );
        }
        else {
            command = this.command;
        }

        method = "API_" + method;

        const commandInstance = this.#bot.commands.get( command );

        // command method os not found
        if ( typeof commandInstance?.[ method ] !== "function" ) return;

        // check command permissions
        if ( !this.isCommandEnabled( commandInstance ) ) return;

        // create context
        const ctx = this.#clone( commandInstance.id );

        try {
            return commandInstance[ method ]( ctx, ...args );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    createWebAooUrl ( data ) {
        const webAppDomain = this.bot.config.telegram.webAppDomain || this.bot.telegram.config.webAppDomain;

        if ( !webAppDomain ) return;

        const url = new URL( "https://" + webAppDomain );

        url.searchParams.set( "locale", this.#user.locale );

        data = JSON.stringify( {
            "userId": this.#user.apiUserId,
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

    async sendDeleteMessage ( messageId ) {
        return this.#user.sendDeleteMessage( messageId );
    }

    async updatePermissions () {
        this.#permissions = await this.#user.getPermissions();
    }

    // private
    get #userCommand () {
        return this.#user.state?.command;
    }

    #clone ( command ) {
        if ( command === this.#command ) return this;

        return new TelegramBotContext( {
            "bot": this.#bot,
            command,
            "user": this.#user,
            "grouo": this.#grouo,
            "channel": this.#channel,
            "permissions": this.#permissions,
            "newUser": this.#newUser,
            "req": this.#req,
        } );
    }
}
