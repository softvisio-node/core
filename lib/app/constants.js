import Duration from "#lib/duration";

export default {
    "rootUserId": "-1",
    "fakeEmailDomain": "@localhost",

    "mainAclId": "-1",
    "mainAclType": "main",

    "apiToken": {
        "id": -1,
        "length": 8,
        "maxAge": null,
    },

    "sessionToken": {
        "id": -2,
        "length": 16,
        "maxAge": null,
    },

    "emailConfirmationToken": {
        "id": -3,
        "length": 8,
        "maxAge": new Duration( "10 minutes" ),
    },

    "passwordResetToken": {
        "id": -4,
        "length": 8,
        "maxAge": new Duration( "10 minutes" ),
    },

    "emailChangeToken": {
        "id": -5,
        "length": 8,
        "maxAge": new Duration( "10 minutes" ),
    },

    "linkTelegramAccountToken": {
        "id": -6,
        "length": 6,
        "maxAge": new Duration( "10 minutes" ),
    },
};
