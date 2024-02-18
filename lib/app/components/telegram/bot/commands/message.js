import { uuidToBuffer, uuidFromBuffer } from "#lib/uuid";

const MESSAGE_MODE = "messageMode",
    EDIT_MESSAGE = "mediaMessages";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, requestMessage ) {
            const message = await this._getMessage( ctx );

            // add text
            if ( ctx.state?.[ MESSAGE_MODE ] === "addText" ) {
                if ( requestMessage?.isText ) {
                    message.setText( requestMessage.text, {
                        "entities": requestMessage.entities,
                    } );

                    await message.save();

                    await this._cancelMessage( ctx );
                }
                else {
                    await this._showAddTextPrompt( ctx );
                }
            }

            // add media
            else if ( ctx.state?.[ MESSAGE_MODE ] === "addMedia" ) {
                if ( requestMessage?.isMedia ) {
                    message.addMedia( requestMessage );

                    await message.save();

                    await this._showMessage( ctx, message, { "canEdit": false } );

                    await this._showAddMediaPrompt( ctx );
                }
                else {
                    await this._showAddMediaPrompt( ctx );
                }
            }

            // edit media
            else if ( ctx.state?.[ MESSAGE_MODE ] === "editMedia" ) {
                return this._showEditMediaPrompt( ctx, message );
            }
            else {
                await this._showMessage( ctx, message );
            }
        }

        async beforeExit ( ctx ) {
            await this._clearMessageState( ctx );

            return super.beforeExit( ctx );
        }

        async API_addText ( ctx ) {
            await ctx.updateState( { [ MESSAGE_MODE ]: "addText" } );

            return this._showAddTextPrompt( ctx );
        }

        async API_deleteText ( ctx ) {
            const message = await this._getMessage( ctx );

            if ( !message ) return;

            message.setText();

            await message.save();

            return this._cancelMessage( ctx );
        }

        async API_addMedia ( ctx ) {
            await ctx.updateState( { [ MESSAGE_MODE ]: "addMedia" } );

            return this._showAddMediaPrompt( ctx );
        }

        async API_editMedia ( ctx ) {
            await ctx.updateState( { [ MESSAGE_MODE ]: "editMedia" } );

            const message = await this._getMessage( ctx );

            return this._showEditMediaPrompt( ctx, message );
        }

        async API_deleteMedia ( ctx, id ) {
            if ( ctx.state[ MESSAGE_MODE ] !== "editMedia" ) return;

            const message = await this._getMessage( ctx );
            if ( !message ) return;

            id = uuidFromBuffer( id );

            const mediaMessageId = ctx.state[ EDIT_MESSAGE ][ id ];
            if ( !mediaMessageId ) return;

            message.deleteMedia( id );

            await message.save();

            await ctx.sendDeleteMessage( mediaMessageId );

            await ctx.updateState( { [ EDIT_MESSAGE ]: { [ id ]: undefined } } );

            if ( !message.isMedia ) return this._cancelMessage( ctx );
        }

        async API_cancelMessage ( ctx ) {
            if ( !ctx.state[ MESSAGE_MODE ] ) return;

            await this._cancelMessage( ctx );
        }

        // protected
        async _getMessage ( ctx ) {}

        async _camEditMessage ( ctx, message ) {
            return true;
        }

        async _showMessage ( ctx, message, { canEdit } = {} ) {
            var res;

            if ( !message || message.isEmpty ) {
                res = await this._showEmptyMessage( ctx );
            }
            else {
                res = await message.send( ctx );
            }

            if ( !res.ok ) return;

            canEdit ??= await this._camEditMessage( ctx, message );

            if ( !canEdit ) return res;

            const buttons = [];

            if ( !message?.text ) {
                buttons.push( [
                    {
                        "text": l10nt( `Add text` ),
                        "callback_data": this.encodeCallbackData( "addText" ),
                    },
                ] );
            }
            else {
                buttons.push( [
                    {
                        "text": l10nt( `Change text` ),
                        "callback_data": this.encodeCallbackData( "addText" ),
                    },
                    {
                        "text": l10nt( `Delete text` ),
                        "callback_data": this.encodeCallbackData( "deleteText" ),
                    },
                ] );
            }

            buttons.push( [
                {
                    "text": l10nt( `Add media` ),
                    "callback_data": this.encodeCallbackData( "addMedia" ),
                },
            ] );

            if ( message?.isMedia ) {
                buttons[ 1 ].push( {
                    "text": l10nt( `Edit media` ),
                    "callback_data": this.encodeCallbackData( "editMedia" ),
                } );
            }

            res = await ctx.send( "sendMessage", {
                "text": l10nt( `Please, choose what you want to dp` ),
                "reply_markup": {
                    "inline_keyboard": buttons,
                },
            } );

            return res;
        }

        async _showEmptyMessage ( ctx ) {
            return ctx.sendText( l10nt( `Ypir message has no content. You need to add text and media.` ) );
        }

        async _showAddTextPrompt ( ctx ) {
            const text = l10nt( `Send me a text to add to the message.

<b>You can use following syntax to format text:</b>
**bold text**: <b>bold text</b>
__italic text__: <i>talic text</i>
~~strikethrough text~~: <s>strikethrough text</s>
||text under spoiler||: <span class="tg-spoiler">text under spoiler</span>` );

            return await ctx.send( "sendMessage", {
                text,
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Cancel` ),
                                "callback_data": this.encodeCallbackData( "cancelMessage" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async _showAddMediaPrompt ( ctx ) {
            const text = l10nt( `Send me medfia files ( photos, videos, audios, documents ) to add to the message.
Photos / videos, audios and documents can be grouped to the album. up to 10 files in the album.` );

            return ctx.send( "sendMessage", {
                text,
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Back` ),
                                "callback_data": this.encodeCallbackData( "cancelMessage" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async _showEditMediaPrompt ( ctx, message ) {
            if ( !message || !message.isMedia ) return this._cancelMessage( ctx );

            const mediaMessages = {};

            for ( const media of message ) {
                const res = await media.send( ctx, {
                    "heignt": 100,
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {
                                    "text": l10nt( `Delete media file` ),
                                    "callback_data": this.encodeCallbackData( "deleteMedia", uuidToBuffer( media.id ) ),
                                },
                            ],
                        ],
                    },
                } );

                mediaMessages[ media.id ] = res.data.message_id;
            }

            await ctx.updateState( { [ EDIT_MESSAGE ]: mediaMessages } );

            return ctx.send( "sendMessage", {
                "text": l10nt( `Press button when you will finish edit media:` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Back` ),
                                "callback_data": this.encodeCallbackData( "cancelMessage" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async _cancelMessage ( ctx ) {
            await this._clearMessageState( ctx );

            return ctx.run( this );
        }

        async _clearMessageState ( ctx ) {
            return ctx.updateState( {
                [ MESSAGE_MODE ]: undefined,
                [ EDIT_MESSAGE ]: undefined,
            } );
        }
    };
