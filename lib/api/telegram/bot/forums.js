export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#getforumtopiciconstickers
        async getForumTopicIconStickers ( data ) {
            return this._request( "getForumTopicIconStickers", data );
        }

        // https://core.telegram.org/bots/api#editforumtopic
        async editForumTopic ( data ) {
            return this._request( "editForumTopic", data );
        }

        // https://core.telegram.org/bots/api#closeforumtopic
        async closeForumTopic ( data ) {
            return this._request( "closeForumTopic", data );
        }

        // https://core.telegram.org/bots/api#reopenforumtopic
        async reopenForumTopic ( data ) {
            return this._request( "reopenForumTopic", data );
        }

        // https://core.telegram.org/bots/api#deleteforumtopic
        async deleteForumTopic ( data ) {
            return this._request( "deleteForumTopic", data );
        }

        // https://core.telegram.org/bots/api#unpinallforumtopicmessages
        async unpinAllForumTopicMessages ( data ) {
            return this._request( "unpinAllForumTopicMessages", data );
        }

        // https://core.telegram.org/bots/api#editgeneralforumtopic
        async editGeneralForumTopic ( data ) {
            return this._request( "editGeneralForumTopic", data );
        }

        // https://core.telegram.org/bots/api#closegeneralforumtopic
        async closeGeneralForumTopic ( data ) {
            return this._request( "closeGeneralForumTopic", data );
        }

        // https://core.telegram.org/bots/api#reopengeneralforumtopic
        async reopenGeneralForumTopic ( data ) {
            return this._request( "reopenGeneralForumTopic", data );
        }

        // https://core.telegram.org/bots/api#hidegeneralforumtopic
        async hideGeneralForumTopic ( data ) {
            return this._request( "hideGeneralForumTopic", data );
        }

        // https://core.telegram.org/bots/api#unhidegeneralforumtopic
        async unhideGeneralForumTopic ( data ) {
            return this._request( "unhideGeneralForumTopic", data );
        }
    };
