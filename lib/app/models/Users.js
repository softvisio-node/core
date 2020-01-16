export default Ext.define( "", {
    "extend": "Ext.data.Model",
    "proxy": {
        "api": {
            "create": "Admin/Users/create",
            "read": "Admin/Users/read",
            "update": "Admin/Users/update",
            "destroy": "Admin/Users/delete",
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
        "gravatar",
        "locale",
        "telegram_name",
        "avatar",
    ],
} );
