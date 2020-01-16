export default Ext.define( "", {
    "extend": "Ext.data.Model",
    "proxy": {
        "api": {
            "read": "Admin/Users/read",
            "update": "Admin/Users/update",
        },
    },
    "fields": [
        "id",

        //
        "guid",
        { "name": "created", "type": "date" },
        "name",
        { "name": "enabled", "type": "bool" },
        "email",
        { "name": "email_confirmed", "type": "bool" },
        { "name": "has_avatar", "type": "bool" },
        "gravatar",
        "locale",
        "telegram_name",
    ],
} );
