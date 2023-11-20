export default Super =>
    class extends Super {

        // XXX
        async setApiUserId ( apiUserId, { dbh } = {} ) {
            apiUserId ||= null;

            if ( this.apiUserId === apiUserId ) return result( 200 );

            dbh ||= this.dbh;

            const res = await dbh.begin( async dbh => {
                let res;

                // unlink
                if ( !apiUserId ) {
                    const oldApiUser = await this.app.users.getUserById( this.apiUserId, { dbh } );
                    if ( !oldApiUser ) throw result( [404, `API user not founs`] );

                    res = await super.setApiUserId( null, { dbh } );
                    if ( !res.ok ) throw res;

                    dbh.doAfterCommit( async () => {
                        this.updateUserFields( { "api_user_id": null } );

                        // notify old api user
                        await this.app.publishToApi( "/notifications/telegram/update/", oldApiUser.id );

                        const body = this.app.templates.get( "telegram/unlink-account/body" ).clone( {
                            "data": {
                                "telegramUsername": this.username,
                                "email": oldApiUser.email,
                            },
                        } );

                        await this.sendNotification( this.app.templates.get( "telegram/unlink-account/subject" ), body );

                        this.app.notifications.sendNotification( "security", oldApiUser.id, this.app.templates.get( "telegram/unlink-account/subject" ), body );
                    } );
                }

                // link
                else {
                    const newApiUser = await this.app.users.getUserById( apiUserId, { dbh } );
                    if ( !newApiUser ) throw result( [404, `API user not founs`] );

                    if ( this.apiUserId ) {
                        var oldApiUser = await this.app.users.getUserById( this.apiUserId, { dbh } );
                        if ( !oldApiUser ) throw result( [404, `API user not founs`] );
                    }

                    const oldTelegramBotUser = await this.bot.users.getByApiUserId( apiUserId, { dbh } );

                    // api user is linked to some other telegram user
                    if ( oldTelegramBotUser ) {

                        // unlink api user
                        res = await oldTelegramBotUser.setApiUserId();
                        if ( !res.ok ) throw res;
                    }

                    // set api user id
                    res = await super.setApiUserId( apiUserId, { dbh } );
                    if ( !res.ok ) throw res;

                    dbh.doAfterCommit( async () => {
                        this.updateUserFields( { "api_user_id": apiUserId } );

                        this.app.publishToApi( "/notifications/telegram/update/", newApiUser.id, this );

                        // notify new api user
                        await this.app.notifications.sendNotification(
                            "security",
                            newApiUser.id,
                            this.app.templates.get( "telegram/link-account/subject" ),
                            this.app.templates.get( "telegram/link-account/body" ).clone( {
                                "data": {
                                    "telegramUsername": this.username,
                                    "email": newApiUser.email,
                                },
                            } )
                        );

                        // notify old api user
                        if ( oldApiUser.id ) {
                            this.app.publishToApi( "/notifications/telegram/update/", oldApiUser.id );

                            await this.app.notifications.sendNotification(
                                "security",
                                oldApiUser.id,
                                this.app.templates.get( "telegram/unlink-account/subject" ),
                                this.app.templates.get( "telegram/unlink-account/body" ).clone( {
                                    "data": {
                                        "telegramUsername": this.username,
                                        "email": oldApiUser.email,
                                    },
                                } )
                            );
                        }
                    } );
                }

                return result( 200 );
            } );

            return res;
        }
    };
