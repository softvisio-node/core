export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/ap i#createforumtopic
        async createForumTopic ( data ) {
            return this._doRequest( "createForumTopic", data );
        }

        // https://core.telegram.org/bots/api#getforumtopiciconstickers
        async getForumTopicIconStickers ( data ) {
            return this._doRequest( "getForumTopicIconStickers", data );
        }

        // https://core.telegram.org/bots/api#editforumtopic
        async editForumTopic ( data ) {
            return this._doRequest( "editForumTopic", data );
        }

        // https://core.telegram.org/bots/api#closeforumtopic
        async closeForumTopic ( data ) {
            return this._doRequest( "closeForumTopic", data );
        }

        // https://core.telegram.org/bots/api#reopenforumtopic
        async reopenForumTopic ( data ) {
            return this._doRequest( "reopenForumTopic", data );
        }

        // https://core.telegram.org/bots/api#deleteforumtopic
        async deleteForumTopic ( data ) {
            return this._doRequest( "deleteForumTopic", data );
        }

        // https://core.telegram.org/bots/api#unpinallforumtopicmessages
        async unpinAllForumTopicMessages ( data ) {
            return this._doRequest( "unpinAllForumTopicMessages", data );
        }

        // https://core.telegram.org/bots/api#editgeneralforumtopic
        async editGeneralForumTopic ( data ) {
            return this._doRequest( "editGeneralForumTopic", data );
        }

        // https://core.telegram.org/bots/api#closegeneralforumtopic
        async closeGeneralForumTopic ( data ) {
            return this._doRequest( "closeGeneralForumTopic", data );
        }

        // https://core.telegram.org/bots/api#reopengeneralforumtopic
        async reopenGeneralForumTopic ( data ) {
            return this._doRequest( "reopenGeneralForumTopic", data );
        }

        // https://core.telegram.org/bots/api#hidegeneralforumtopic
        async hideGeneralForumTopic ( data ) {
            return this._doRequest( "hideGeneralForumTopic", data );
        }

        // https://core.telegram.org/bots/api#unhidegeneralforumtopic
        async unhideGeneralForumTopic ( data ) {
            return this._doRequest( "unhideGeneralForumTopic", data );
        }
    };
