import ForumChat from "./bot/forum-chat.js";

export default Super =>
    class extends Super {
        #forumChat;

        // properties
        get forumChat () {
            return this.#forumChat;
        }

        async init () {
            this.#forumChat = new ForumChat( this );

            return super.init();
        }
    };
