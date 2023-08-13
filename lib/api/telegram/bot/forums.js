export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#getforumtopiciconstickers
        async getForumTopicIconStickers () {}

        // https://core.telegram.org/bots/api#editforumtopic
        async editForumTopic () {}

        // https://core.telegram.org/bots/api#closeforumtopic
        async closeForumTopic () {}

        // https://core.telegram.org/bots/api#reopenforumtopic
        async reopenForumTopic () {}

        // https://core.telegram.org/bots/api#deleteforumtopic
        async deleteForumTopic () {}

        // https://core.telegram.org/bots/api#unpinallforumtopicmessages
        async unpinAllForumTopicMessages () {}

        // https://core.telegram.org/bots/api#editgeneralforumtopic
        async editGeneralForumTopic () {}

        // https://core.telegram.org/bots/api#closegeneralforumtopic
        async closeGeneralForumTopic () {}

        // https://core.telegram.org/bots/api#reopengeneralforumtopic
        async reopenGeneralForumTopic () {}

        // https://core.telegram.org/bots/api#hidegeneralforumtopic
        async hideGeneralForumTopic () {}

        // https://core.telegram.org/bots/api#unhidegeneralforumtopic
        async unhideGeneralForumTopic () {}
    };
