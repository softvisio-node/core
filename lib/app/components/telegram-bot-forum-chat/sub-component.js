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

        async _createBot ( dbh, id, options ) {
            const client = this.app.telegram.clients.getClient();

            if ( !client ) return result( [ 500, `Telegram client is requires` ] );

            console.log( options );
            process.exit();

            var res;

            // create group
            res = await client.call( "channels.createChannel", {
                "broadcast": false,
                "megagroup": true,
                "forum": true,
                "title": "----- aitp grup",
                "about": "group description",
            } );
            console.log( res + "" );

            // const channel = res.data.chats[ 0 ];
            const channel = {
                "id": 2048201620,
                "access_hash": "14787902832133000389",
            };

            const inputChannel = {
                "_": "inputChannel",
                "channel_id": channel.id,
                "access_hash": channel.access_hash,
            };

            // XXX
            res = await client.call( "contacts.search", {
                "q": "@" + "global_service_localhost_bot",
                "limit": 1,
            } );

            const user = res.data.users[ 0 ];

            const inputUser = {
                "_": "inputUser",
                "user_id": user.id,
                "access_hash": user.access_hash,
            };

            // XXX add bot as group admin
            res = await client.call( "channels.inviteToChannel", {
                "channel": inputChannel,
                "users": [ inputUser ],
            } );
            console.log( res );

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
            console.log( res );

            // XXX remove me from group users
            // res = await client.call( "channels.leaveChannel", {
            //     "channel": inputChannel,
            // } );
            // console.log( res );
        }
    };
