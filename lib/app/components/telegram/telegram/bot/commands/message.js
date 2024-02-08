import Message from "../message.js";
import { uuidToBuffer, uuidFromBuffer } from "#lib/uuid";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            const post = await this._getMessage( ctx );

            // add text
            if ( ctx.state.mode === "addText" ) {
                if ( message?.isText ) {
                    post.text = message.text;
                    post.entities = message.entities;

                    await post.save();

                    await this._cancelMessage( ctx );
                }
                else {
                    await this._showAddTextPrompt( ctx );
                }
            }

            // add media
            else if ( ctx.state.mode === "addMedia" ) {
                if ( message?.isMedia ) {
                    post.addMedia( message );

                    await post.save();

                    await this._showMessage( ctx, post, { "showButtons": false } );

                    await this._showAddMediaPrompt( ctx );
                }
                else {
                    await this._showAddMediaPrompt( ctx );
                }
            }

            // edit media
            else if ( ctx.state.mode === "editMedia" ) {
                return this._showEditMediaPrompt( ctx, post );
            }
            else {
                await this._showMessage( ctx, post );
            }
        }

        async beforeExit ( ctx ) {
            await this._clearMessageState( ctx );

            return super.beforeExit( ctx );
        }

        async API_addText ( ctx ) {
            await ctx.updateState( { "mode": "addText" } );

            return this._showAddTextPrompt( ctx );
        }

        async API_deleteText ( ctx ) {
            const message = await this._getMessage( ctx );

            if ( !message ) return;

            message.text = undefined;

            await message.save();

            return this._cancelMessage( ctx );
        }

        async API_addMedia ( ctx ) {
            await ctx.updateState( { "mode": "addMedia" } );

            return this._showAddMediaPrompt( ctx );
        }

        async API_editMedia ( ctx ) {
            await ctx.updateState( { "mode": "editMedia" } );

            const message = await this._getMessage( ctx );

            return this._showEditMediaPrompt( ctx, message );
        }

        async API_deleteMedia ( ctx, id ) {
            if ( ctx.state.mode !== "editMedia" ) return;

            const message = await this._getMessage( ctx );
            if ( !message ) return;

            id = uuidFromBuffer( id );

            const mediaMessageId = ctx.state.mediaMessages[ id ];
            if ( !mediaMessageId ) return;

            message.deleteMedia( id );

            await message.save();

            await ctx.sendDeleteMessage( mediaMessageId );

            await ctx.updateState( { "mediaMessages": { [ id ]: undefined } } );

            if ( !message.isMedia ) return this._cancelMessage( ctx );
        }

        async API_cancelMessage ( ctx ) {
            if ( !ctx.state.mode ) return;

            await this._cancelMessage( ctx );
        }

        // protected
        _createMessage () {
            return new Message( this.bot );
        }

        async _getMessage ( ctx ) {}

        async _showMessage ( ctx, message, { showButtons = true } = {} ) {
            var res;

            if ( !message || message.isEmpty ) {
                res = await this._showEmptyMessage( ctx );
            }
            else {
                res = await ctx.send( message.sendMethod, message.toMessage() );
            }

            if ( !res.ok ) return;

            if ( !showButtons ) return res;

            const buttons = [];

            if ( !message?.text ) {
                buttons.push( [
                    {
                        "text": this.l10nt( `Add text` ),
                        "callback_data": this.encodeCallbackData( "addText" ),
                    },
                ] );
            }
            else {
                buttons.push( [
                    {
                        "text": this.l10nt( `Change text` ),
                        "callback_data": this.encodeCallbackData( "addText" ),
                    },
                    {
                        "text": this.l10nt( `Delete text` ),
                        "callback_data": this.encodeCallbackData( "deleteText" ),
                    },
                ] );
            }

            buttons.push( [
                {
                    "text": this.l10nt( `Add medua` ),
                    "callback_data": this.encodeCallbackData( "addMedia" ),
                },
            ] );

            if ( message?.isMedia ) {
                buttons[ 1 ].push( {
                    "text": this.l10nt( `Delete media` ),
                    "callback_data": this.encodeCallbackData( "editMedia" ),
                } );
            }

            res = await ctx.send( "sendMessage", {
                "text": this.l10nt( `Please, choose what you want to dp` ),
                "reply_markup": {
                    "inline_keyboard": buttons,
                },
            } );

            return res;
        }

        async _showEmptyMessage ( ctx ) {
            return ctx.sendText( this.l10nt( `Ypir message has no content. You need to add text and media.` ) );
        }

        async _showAddTextPrompt ( ctx ) {
            const text = this.l10nt( `
Send me a text to add to the message.

<b>You can use following syntax to format text:</b>
**bold text**: <b>bold text</b>
__italic text__: <i>talic text</i>_
~~strikethrough~~: <s>strikethrough</s>
||spoiler||: <span class="tg-spoiler">spoiler</span>
` );

            return await ctx.send( "sendMessage", {
                text,
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Cancel` ),
                                "callback_data": this.encodeCallbackData( "cancelMessage" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async _showAddMediaPrompt ( ctx ) {
            return ctx.send( "sendMessage", {
                "text": this.l10nt( `
Send me medfia files ( photos, videos, audios, documents ) to add to the message.
Photos / videos, audios and documents can be grouped to the album. up to 10 files in the album.
` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Back` ),
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
                const res = await ctx.send( media.sendMethod, {
                    [ media.mediaType ]: media.fileId,
                    "heignt": 100,
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {
                                    "text": this.l10nt( `x Delete media file` ),
                                    "callback_data": this.encodeCallbackData( "deleteMedia", uuidToBuffer( media.id ) ),
                                },
                            ],
                        ],
                    },
                } );

                mediaMessages[ media.id ] = res.data.message_id;
            }

            await ctx.updateState( { mediaMessages } );

            return ctx.send( "sendMessage", {
                "text": this.l10nt( `Press button when you will finish edit media:` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Back` ),
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
                "mode": undefined,
                "mediaMessages": undefined,
            } );
        }
    };
