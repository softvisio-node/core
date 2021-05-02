import "#index";

import Smtp from "#lib/smtp";

export default Super =>

    /** class: Settings
     * summary: App settings.
     * permissions: [admin]
     */
    class extends ( Super || Object ) {

        /** method: API_read
         * summary: Read application settings.
         */
        async API_read ( auth ) {
            return result( 200, this.api.settings );
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
            return this.api.updateSettings( settings );
        }

        /** method: API_test_smtp
         * summary: Test SMTP server settings.
         * params:
         *   - name: settings
         *     required: true
         *     schema:
         *       type: object
         *       properties:
         *         smtp_hostname: { type: string }
         *         smtp_port: { type: integer, minimum: 0, maximum: 65535 }
         *         smtp_username: { type: string }
         *         smtp_password: { type: string }
         *       required: []
         *       additionalProperties: false
         */
        async API_test_smtp ( auth, settings ) {
            var smtp = new Smtp( {
                "hostname": settings.smtp_hostname,
                "port": settings.smtp_port,
                "username": settings.smtp_username,
                "password": settings.smtp_password,
            } );

            return smtp.test();
        }
    };
