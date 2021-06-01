import "#index";

import Prototype from "../../prototype.js";
import Smtp from "#lib/smtp";

export default class extends Prototype {
    async API_read ( ctx ) {
        return result( 200, this.api.settings );
    }

    async API_update ( ctx, settings ) {
        return this.api.updateSettings( settings );
    }

    async API_test_smtp ( ctx, settings ) {
        var smtp = new Smtp( {
            "hostname": settings.smtp_hostname,
            "port": settings.smtp_port,
            "username": settings.smtp_username,
            "password": settings.smtp_password,
        } );

        return smtp.test();
    }
}
