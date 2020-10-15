const { mixin } = require( "../../../mixins" );
const Smtp = require( "../../../smtp" );

module.exports = mixin( Super =>

/** class: Settings
         * summary: App settings.
         * permissions:
         *   - admin
         */
    class extends Super {

        /** method: API_read
             * summary: Read application settings.
             */
        async API_read ( auth ) {
            return [200, this.api.appSettings];
        }

        /** method: API_update
             * summary: Update application settings.
             * params:
             *   - name: settings
             *     summary: application settings object
             *     required: true
             *     schema:
             *       type: object
             */
        async API_update ( auth, settings ) {
            return this.api.updateAppSettings( settings );
        }

        /** method: API_test_smtp
             * summary: Test SMTP server settings.
             * params:
             *   - name: settings
             *     required: true
             *     schema:
             *       type: object
             *       properties:
             *         smtp_host:
             *           type: string
             *         smtp_port:
             *           type: number
             *         smtp_username:
             *           type: string
             *         smtp_password:
             *           type: string
             *         smtp_tls:
             *           type: boolean
             *       required: []
             *       additionalProperties: false
             */
        async API_test_smtp ( auth, settings ) {
            var smtp = new Smtp( {
                "host": settings.smtp_host,
                "port": settings.smtp_port,
                "username": settings.smtp_username,
                "password": settings.smtp_password,
                "tls": settings.smtp_tls,
            } );

            return smtp.test();
        }
    } );
