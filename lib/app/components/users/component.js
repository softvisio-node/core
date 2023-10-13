import Component from "#lib/app/component";
import Users from "./users.js";
import File from "#lib/file";

const defaultAvatarFile = new File( new URL( "resources/default-avatar.png", import.meta.url ) );

export default class extends Component {
    async _install () {
        return new Users( this.app, this.config );
    }

    async _configureInstance () {
        return this.instance.configure();
    }

    async _init () {

        // default avatar http handler
        this.app.publicHttpServer?.get( "/storage/default-avatar", async req =>
            req.end( {
                "status": 200,
                "headers": {
                    "cache-control": this.config.avatarCacheControl,
                },
                "body": defaultAvatarFile,
            } ) );

        return this.instance.init();
    }
}
