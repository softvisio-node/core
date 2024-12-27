import sql from "#lib/sql";
import Bot from "./bot.js";

export default Super =>
    class extends Super {

        // protected
        _applySubConfig () {
            super._applySubConfig();

            this._mergeSubConfig( import.meta.url );
        }

        _applySubSchema ( schema ) {
            return this._mergeSubSchema( super._applySubSchema( schema ), import.meta.url );
        }

        _buildBot () {
            return Bot( super._buildBot() );
        }

        // XXX update telegram client API
        async _createBot ( dbh, id, options ) {
            var res;

            res = await dbh.selectRow( sql`SELECT telegram_group_id FROM telegram_bot_forum_chat WHERE telegram_bot_id = ?`, [ id ] );
            if ( !res.ok ) return res;

            // group exists
            if ( res.data ) return result( 200 );

            res = await super._createBot( dbh, id, options );
            if ( !res.ok ) return res;

            res = await this.app.telegram.clients.getClient( this.config.forumChat.clientId );
            if ( !res.ok ) return res;

            const client = res.data;

            // XXX refactor for new api or remove
            try {
                res = await client.call( "contacts.search", {
                    "q": "@" + options.fields.username,
                    "limit": 1,
                } );
                if ( !res.ok ) throw res;

                const user = res.data.users?.[ 0 ];

                if ( !user || +user.id !== id ) throw result( [ 500, `Bot not found` ] );

                const inputUser = {
                    "_": "inputUser",
                    "user_id": user.id,
                    "access_hash": user.access_hash,
                };

                // create group
                res = await client.call( "channels.createChannel", {
                    "broadcast": false,
                    "megagroup": true,
                    "forum": true,
                    "title": options.fields.first_name,
                    "about": options.fields.first_name,
                } );
                if ( !res.ok ) throw res;

                const channel = res.data.chats[ 0 ];

                const inputChannel = {
                    "_": "inputChannel",
                    "channel_id": channel.id,
                    "access_hash": channel.access_hash,
                };

                // add bot to group
                res = await client.call( "channels.inviteToChannel", {
                    "channel": inputChannel,
                    "users": [ inputUser ],
                } );
                if ( !res.ok ) throw res;

                // set bot admin permissions
                res = await client.call( "channels.editAdmin", {
                    "channel": inputChannel,
                    "user_id": inputUser,
                    "admin_rights": {
                        "_": "chatAdminRights",

                        "change_info": true,
                        "post_messages": true,
                        "edit_messages": true,
                        "delete_messages": true,
                        "ban_users": true,
                        "invite_users": true,
                        "pin_messages": true,
                        "add_admins": true,
                        "anonymous": true,
                        "manage_call": true,
                        "other": true,
                        "manage_topics": true,
                        "post_stories": true,
                        "edit_stories": true,
                        "delete_stories": true,
                    },
                    "rank": "owner",
                } );
                if ( !res.ok ) throw res;

                // remove client from group users
                if ( this.config.forumChat.deleteGroupCreator ) {
                    res = await client.call( "channels.leaveChannel", {
                        "channel": inputChannel,
                    } );
                    if ( !res.ok ) throw res;
                }

                res = await dbh.do( sql`INSERT INTO telegram_bot_forum_chat ( telegram_bot_id, telegram_group_id ) VALUES ( ?, ? )`, [ id, "-100" + channel.id ] );
                if ( !res.ok ) throw res;
            }
            catch ( e ) {
                await client.disconnect();

                return result.catch( e );
            }

            return result( 200 );
        }
    };
