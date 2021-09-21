import _const from "#lib/_browser/const";

const CONST = {
    ..._const,

    "AUTH_USER": 1,
    "AUTH_TOKEN": 2,
    "AUTH_SESSION": 3,
    "AUTH_EMAIL_CONFIRM": 4,
    "AUTH_PASSWORD_RESET": 5,

    "SQL_LOCKS": {
        "MIGRATION": -1,
    },
};

export default CONST;
