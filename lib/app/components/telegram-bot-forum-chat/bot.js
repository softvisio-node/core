import ForumChat from "./bot/forum-chat.js";

export default Super =>
    class extends Super {
        #forumChat;

        constructor ( ...args ) {
            super( ...args );

            this.#forumChat = new ForumChat( this );
        }

        // properties
        get forumChat () {
            return this.#forumChat;
        }

        async init () {
            var res;

            res = await super.init();
            if ( !res.ok ) return res;

            return this.#forumChat.init();
        }

        async _runSupergroupRequest ( ctx, req ) {
            if ( ctx.group.id === this.#forumChat.groupId ) {
                return this.#forumChat.runSupergroupRequest( ctx, req );
            }
            else {
                return super._runSupergroupRequest( ctx, req );
            }
        }
    };
