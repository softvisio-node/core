export default Ext.define( "", {
    "extend": "Ext.data.Model",
    "proxy": {
        "api": {
            "read": "Admin/Settings/read",
            "update": "Admin/Settings/update",
        },
    },
    "fields": [
        "id",

        //
        "domain",

        // SMTP
        "smtp_host",
        "smtp_port",
        "smtp_username",
        "smtp_password",
        { "name": "smtp_tls", "type": "bool" },

        // telegram
        "telergam_bot_name",
        "telegram_bot_key",
        { "name": "telegram_bot_enabled", "type": "bool" },
        { "name": "telegram_signin_enabled", "type": "bool" },
    ],
} );
