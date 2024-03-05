import ForumChat from "./bot/forum-chat.js";

export default Super =>
    class extends Super {
        #forumChat;

        // properties
        get forumChat () {
            return this.#forumChat;
        }

        async init () {
            var res;

            res = await super.init();
            if ( !res.ok ) return res;

            this.#forumChat = new ForumChat( this );

            return this.#forumChat.init();
        }
    };
