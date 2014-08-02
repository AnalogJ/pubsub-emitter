/**
 * Module dependencies.
 */
var util = require('util')
    , _ = require('lodash')


/**
 * Module errors
 */
var Err = {
    dependency: function (dependent, dependency) {
        return new Error( '\n' +
                'Cannot use `' + dependent + '` hook ' +
                'without the `' + dependency + '` hook enabled!'
        );
    }
};


module.exports = function(sails) {


    /**
     * Expose Hook definition
     */

    return {

        defaults: {

            sockets:{

                adapter: 'redis',
                host: 'localhost',
                port: 6379
                //db: 1,//'sails',
                //pass: '',


            }

        },

        initialize: function(cb) {

            var self = this;
            sails.io = {};
            //setup the ducktyped socket.io-emitter
            sails.io.sockets = require('./lib/emitter')({
                host: sails.config.sockets.host,
                port: sails.config.sockets.port,
                key: 'dispatch'
            });

            // Add low-level, generic socket methods.  These are mostly just wrappers

            // around socket.io, to enforce a little abstraction.
            addLowLevelSocketMethods();

            if (!sails.hooks.orm) {
                return cb( Err.dependency('pubsub', 'orm') );
            }

            // Wait for `hook:orm:loaded`
            sails.on('hook:orm:loaded', function() {

                // Do the heavy lifting
                self.augmentModels();

                // Indicate that the hook is fully loaded
                cb();

            });

            // When the orm is reloaded, re-apply all of the pubsub methods to the
            // models
            sails.on('hook:orm:reloaded', function() {
                self.augmentModels();

                // Trigger an event in case something needs to respond to the pubsub reload
                sails.emit('hook:pubsub:reloaded');
            });

        },

        augmentModels: function() {
            // Augment models with room/socket logic (& bind context)
            for (var identity in sails.models) {

                var AugmentedModel = _.defaults(sails.models[identity], getPubsubMethods(), {autosubscribe: true} );
                _.bindAll(AugmentedModel,
                    'subscribe',
                    'watch',
                    'introduce',
                    'retire',
                    'unwatch',
                    'unsubscribe',
                    'publish',
                    'room',
                    'publishCreate',
                    'publishUpdate',
                    'publishDestroy',
                    'publishAdd',
                    'publishRemove'
                );
                sails.models[identity] = AugmentedModel;
            }
        }
    };

    function addLowLevelSocketMethods () {

        sails.sockets = {};
        sails.sockets.DEFAULT_EVENT_NAME = 'message';

        sails.sockets.subscribeToFirehose = require('./drink')(sails);
        sails.sockets.unsubscribeFromFirehose = require('./drink')(sails);

        sails.sockets.publishToFirehose = require('./squirt')(sails);


        /**
         * Subscribe a socket to a generic room
         * @param  {object} socket   The socket to subscribe.
         * @param  {string} roomName The room to subscribe to
         */
        sails.sockets.join = function(sockets, roomName) {
            var notImplementedError =
                'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'This call has failed silently.';
            sails.log.warn(notImplementedError);
            return false;

        };

        /**
         * Unsubscribe a socket from a generic room
         * @param  {object} socket   The socket to unsubscribe.
         * @param  {string} roomName The room to unsubscribe from
         */
        sails.sockets.leave = function(sockets, roomName) {

            var notImplementedError =
                'The standalone socket emitter does not support any subscription/req.socket based methods.'
            'This call has failed silently.';
            sails.log.warn(notImplementedError);

            return false;
        };

        /**
         * Broadcast a message to a room
         *
         * If the event name is omitted, "message" will be used by default.
         * Thus, sails.sockets.broadcast(roomName, data) is also a valid usage.
         *
         * @param  {string} roomName The room to broadcast a message to
         * @param  {string} eventName    The event name to broadcast
         * @param  {object} data     The data to broadcast
         * @param  {object} socket   Optional socket to omit
         */

        sails.sockets.broadcast = function(roomName, eventName, data, socketToOmit) {
            // If the 'eventName' is an object, assume the argument was omitted and
            // parse it as data instead.
            if (typeof eventName === 'object') {
                data = eventName;
                eventName = null;
            }

            // Default to the sails.sockets.DEFAULT_EVENT_NAME.
            if (!eventName) {
                eventName = sails.sockets.DEFAULT_EVENT_NAME;
            }

            if(socketToOmit){
                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'socketToOmit has been silently ignored.';
                sails.log.warn(notImplementedError);
            }

            sails.io.sockets.in(roomName).emit(eventName, data);

        };



        /**
         * Broadcast a message to all connected sockets
         *
         * If the event name is omitted, sails.sockets.DEFAULT_EVENT_NAME will be used by default.
         * Thus, sails.sockets.blast(data) is also a valid usage.
         *
         * @param  {string} event    The event name to broadcast
         * @param  {object} data     The data to broadcast
         * @param  {object} socket   Optional socket to omit
         */

        sails.sockets.blast = function(eventName, data, socketToOmit) {

            // If the 'eventName' is an object, assume the argument was omitted and
            // parse it as data instead.
            if (typeof eventName === 'object') {
                data = eventName;
                eventName = null;
            }

            // Default to the sails.sockets.DEFAULT_EVENT_NAME eventName.
            if (!eventName) {
                eventName = sails.sockets.DEFAULT_EVENT_NAME;
            }

            // If we were given a valid socket to omit, broadcast from there.
            if (socketToOmit ) {
                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'socketToOmit has been silently ignored.';
                sails.log.warn(notImplementedError);            }

                sails.io.sockets.emit(eventName, data);
        };




        /**
         * Get the ID of a socket object
         * @param  {object} socket The socket object to get the ID of
         * @return {string}        The socket's ID
         */
        sails.sockets.id = function(socket) {
            var notImplementedError =
                'The standalone socket emitter does not support any subscription/req.socket based methods.'
            'req.socket will always return undefined.';
            sails.log.warn(notImplementedError);
            return undefined;
        };

        /**
         * Emit a message to one or more sockets by ID
         *
         * If the event name is omitted, "message" will be used by default.
         * Thus, sails.sockets.emit(socketIDs, data) is also a valid usage.
         *
         * @param  {array|string} socketIDs The ID or IDs of sockets to send a message to
         * @param  {string} event     The name of the message to send
         * @param  {object} data      Optional data to send with the message
         */
        sails.sockets.emit = function(socketIDs, eventName, data) {
            var notImplementedError =
                'The standalone socket emitter does not support any subscription/req.socket based methods.'
            'This call has failed silently.';
            sails.log.warn(notImplementedError);
        };

        /**
         * Get the list of IDs of sockets subscribed to a room
         * @param  {string} roomName The room to get subscribers of
         * @return {array} An array of socket instances
         */
        sails.sockets.subscribers = function(roomName) {
            var notImplementedError =
                'The standalone socket emitter does not support any subscription/req.socket based methods.'
            'This call has failed silently.';
            sails.log.warn(notImplementedError);
            return []
        };

        /**
         * Get the list of rooms a socket is subscribed to
         * @param  {object} socket The socket to get rooms for
         * @return {array} An array of room names
         */
        sails.sockets.socketRooms = function(socket) {
            var notImplementedError =
                'The standalone socket emitter does not support any subscription/req.socket based methods.'
            'This call has failed silently.';
            sails.log.warn(notImplementedError);
            return [];
        };

        /**
         * Get the list of all rooms
         * @return {array} An array of room names, minus the empty room
         */
        sails.sockets.rooms = function() {
            var notImplementedError =
                'The standalone socket emitter does not support any subscription/req.socket based methods.'
            'This call has failed silently.';
            sails.log.warn(notImplementedError);
            return [];
        };

    }

    /**
     * These methods get appended to the Model class objects
     * Some take req.socket as an argument to get access
     * to user('s|s') socket object(s)
     */

    function getPubsubMethods () {

        return {

            /**
             * Broadcast a message to a room
             *
             * Wrapper for sails.sockets.broadcast
             * Can be overridden at a model level, i.e. for encapsulating messages within a single event name.
             *
             * @param  {string} roomName The room to broadcast a message to
             * @param  {string} eventName    The event name to broadcast
             * @param  {object} data     The data to broadcast
             * @param  {object} socket   Optional socket to omit
             *
             * @api private
             */

            broadcast: function(roomName, eventName, data, socketToOmit) {
                sails.sockets.broadcast(roomName, eventName, data, socketToOmit);
            },


            /**
             * TODO: document
             */
            getAllContexts: function() {

                var contexts = ['update', 'destroy', 'message'];
                _.each(this.associations, function(association) {
                    if (association.type == 'collection') {
                        contexts.push('add:'+association.alias);
                        contexts.push('remove:'+association.alias);
                    }
                });
                return contexts;

            },

            /**
             * Broadcast a custom message to sockets connected to the specified models
             * @param {Object|String|Finite} record -- record or ID of record whose subscribers should receive the message
             * @param {Object|Array|String|Finite} message -- the message payload
             * @param {Request|Socket} req - if specified, broadcast using this
             * socket (effectively omitting it)
             *
             */

            message: function(record, data, req) {

                // If a request object was sent, get its socket, otherwise assume a socket was sent.
                var socketToOmit = (req && req.socket ? req.socket : req);

                // If no records provided, throw an error
                if (!record) {
                    return sails.log.error(
                        util.format(
                                'Must specify a record or record ID when calling `Model.publish` '+
                                '(you specified: `%s`)', record));
                }

                // Otherwise publish to each instance room
                else {

                    // Get the record ID (if the record argument isn't already a scalar)
                    var id = record[this.primaryKey] || record;
                    // Get the socket room to publish to
                    var room = this.room(id, "message");
                    // Create the payload
                    var payload = {
                        verb: "messaged",
                        id: id,
                        data: data
                    };

                    this.broadcast( room, this.identity, payload, socketToOmit );
                    sails.log.silly("Published message to ", room, ": ", payload);

                }

            },

            /**
             * Broadcast a message to sockets connected to the specified models
             * (or null to broadcast to the entire class room)
             *
             * @param {Object|Array|String|Finite} models -- models whose subscribers should receive the message
             * @param {String} eventName -- the event name to broadcast with
             * @param {String} context -- the context to broadcast to
             * @param {Object|Array|String|Finite} data -- the message payload
             * socket (effectively omitting it)
             *
             * @api private
             */

            publish: function (models, eventName, context, data, req) {
                var self = this;

                // If the event name is an object, assume we're seeing `publish(models, data, req)`
                if (typeof eventName === 'object') {
                    req = context;
                    context = null;
                    data = eventName;
                    eventName = null;
                }

                // Default to the event name being the model identity
                if (!eventName) {
                    eventName = this.identity;
                }

                // If the context is an object, assume we're seeing `publish(models, eventName, data, req)`
                if (typeof context === 'object' && context !== null) {
                    req = data;
                    data = context;
                    context = null;
                }

                // Default to using the message context
                if (!context) {
                    sails.log.warn('`Model.publish` should specify a context; defaulting to "message".  Try `Model.message` instead?');
                    context = 'message';
                }

                // If a request object was sent, get its socket, otherwise assume a socket was sent.
                var socketToOmit = (req && req.socket ? req.socket : req);

                // If no models provided, publish to the class room
                if (!models) {

                    sails.log.silly('Published ', eventName, ' to ', self.classRoom());
                    self.broadcast( self.classRoom(), eventName, data, socketToOmit );
                    return;
                }

                // Otherwise publish to each instance room
                else {
                    models = this.pluralize(models);
                    var ids = _.pluck(models, this.primaryKey);
                    if ( ids.length === 0 ) {
                        sails.log.warn('Can\'t publish a message to an empty list of instances-- ignoring...');
                    }
                    _.each(ids,function eachInstance (id) {
                        var room = self.room(id, context);
                        sails.log.silly("Published ", eventName, " to ", room);
                        self.broadcast( room, eventName, data, socketToOmit );


                        // Also broadcasts a message to the legacy instance room (derived by
                        // using the `legacy_v0.9` context).
                        // Uses traditional eventName === "message".
                        // Uses traditional message format.
                        if (sails.config.sockets['backwardsCompatibilityFor0.9SocketClients']) {
                            var legacyRoom = self.room(id, 'legacy_v0.9');
                            var legacyMsg = _.cloneDeep(data);
                            legacyMsg.model = self.identity;
                            if (legacyMsg.verb === 'created') { legacyMsg.verb = 'create'; }
                            if (legacyMsg.verb === 'updated') { legacyMsg.verb = 'update'; }
                            if (legacyMsg.verb === 'destroyed') { legacyMsg.verb = 'destroy'; }
                            self.broadcast( legacyRoom, 'message', legacyMsg, socketToOmit );
                        }
                    });
                }

            },

            /**
             * Check that models are a list, if not, make them a list
             * Also if they are ids, make them dummy objects with an `id` property
             *
             * @param {Object|Array|String|Finite} models
             * @returns {Array} array of things that have an `id` property
             *
             * @api private
             * @synchronous
             */
            pluralize: function (models) {

                // If `models` is a non-array object,
                // turn it into a single-item array ("pluralize" it)
                // e.g. { id: 7 } -----> [ { id: 7 } ]
                if ( !_.isArray(models) ) {
                    var model = models;
                    models = [model];
                }

                // If a list of ids things look ids (finite numbers or strings),
                // wrap them up as dummy objects; e.g. [1,2] ---> [ {id: 1}, {id: 2} ]
                var self = this;
                return _.map(models, function (model) {
                    if ( _.isString(model) || _.isFinite(model) ) {
                        var id = model;
                        var data = {};
                        data[self.primaryKey] = id;
                        return data;
                    }
                    return model;
                });
            },

            /**
             * @param  {String|} id
             * @return {String}    name of the instance room for an instance of this model w/ given id
             * @synchronous
             */
            room: function (id, context) {
                if (!id) return sails.log.error('Must specify an `id` when calling `Model.room(id)`');
                return 'sails_model_'+this.identity+'_'+id+':'+context;
            },

            classRoom: function () {

                return this._classRoom();
            },

            /**
             * @return {String} name of this model's global class room
             * @synchronous
             * @api private
             */
            _classRoom: function() {
                return 'sails_model_create_'+this.identity;
            },

            /**
             * Return the set of sockets subscribed to this instance
             * @param  {String|Integer} id
             * @return {Array[String]}
             * @synchronous
             * @api private
             */
            subscribers: function (id, context) {
                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'This call has failed silently.';
                sails.log.warn(notImplementedError);
                return [];
            },

            /**
             * Return the set of sockets subscribed to this class room
             * @return {Array[String]}
             * @synchronous
             * @api private
             */
            watchers: function() {
                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'This call has failed silently.';
                sails.log.warn(notImplementedError);
                return [];
            },

            /**
             * Subscribe a socket to a handful of records in this model
             *
             * Usage:
             * Model.subscribe(req,socket [, records] )
             *
             * @param {Request|Socket} req - request containing the socket to subscribe, or the socket itself
             * @param {Object|Array|String|Finite} records - id, array of ids, model, or array of records
             *
             * e.g.
             *   // Subscribe to User.create()
             *   User.subscribe(req.socket)
             *
             *   // Subscribe to User.update() and User.destroy()
             *   // for the specified instances (or user.save() / user.destroy())
             *   User.subscribe(req.socket, users)
             *
             * @api public
             */

            subscribe: function (req, records, contexts) {
                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'This call has failed silently.';
                sails.log.warn(notImplementedError);

            },

            /**
             * Unsubscribe a socket from some records
             *
             * @param {Request|Socket} req - request containing the socket to unsubscribe, or the socket itself
             * @param {Object|Array|String|Finite} models - id, array of ids, model, or array of models
             */

            unsubscribe: function (req, records, contexts) {
                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'This call has failed silently.';
                sails.log.warn(notImplementedError);
            },

            /**
             * Publish an update on a particular model
             *
             * @param {String|Finite} id
             *    - primary key of the instance we're referring to
             *
             * @param {Object} changes
             *    - an object of changes to this instance that will be broadcasted
             *
             * @param {Request|Socket} req - if specified, broadcast using this socket (effectively omitting it)
             *
             * @api public
             */

            publishUpdate: function (id, changes, req, options) {

                // Make sure there's an options object
                options = options || {};

                // Ensure that we're working with a clean, unencumbered object
                changes = _.clone(changes);

                // Enforce valid usage
                var validId = _.isString(id) || _.isFinite(id);
                if ( !validId  ) {
                    return sails.log.error(
                            'Invalid usage of ' +
                            '`' + this.identity + '.publishUpdate(id, changes, [socketToOmit])`'
                    );
                }

                if (sails.util.isFunction(this.beforePublishUpdate)) {
                    this.beforePublishUpdate(id, changes, req, options);
                }

                var data = {
                    model: this.identity,
                    verb: 'update',
                    data: changes,
                    id: id
                };

                if (options.previous && !options.noReverse) {

                    var previous = options.previous;

                    // If any of the changes were to association attributes, publish add or remove messages.
                    _.each(changes, function(val, key) {

                        // If value wasn't changed, do nothing
                        if (val == previous[key]) return;

                        var attributes = this.attributes || {};
                        var referencedModel = attributes[key] && attributes[key].model;

                        // Bail if this attribute isn't in the model's schema
                        if (referencedModel) {
                            // Get the associated model class
                            var ReferencedModel = sails.models[referencedModel];
                            // Get the inverse association definition, if any
                            reverseAssociation = _.find(ReferencedModel.associations, {collection: this.identity}) || _.find(ReferencedModel.associations, {model: this.identity});

                            if (reverseAssociation) {
                                // If this is a to-many association, do publishAdd or publishRemove as necessary
                                // on the other side
                                if (reverseAssociation.type == 'collection') {
                                    if (previous[key]) {
                                        ReferencedModel.publishRemove(previous[key], reverseAssociation.alias, id, {noReverse:true});
                                    }
                                    if (val) {
                                        ReferencedModel.publishAdd(val, reverseAssociation.alias, id, {noReverse:true});
                                    }
                                }
                                // Otherwise do a publishUpdate
                                else {
                                    var pubData = {};
                                    // If there was a previous association, notify it that it has been nullified
                                    if (previous[key]) {
                                        pubData[reverseAssociation.alias] = null;
                                        ReferencedModel.publishUpdate(previous[key], pubData, req, {noReverse:true});
                                    }
                                    // If there's a new association, notify it that it has been linked
                                    if (val) {
                                        pubData[reverseAssociation.alias] = id;
                                        ReferencedModel.publishUpdate(val, pubData, req, {noReverse:true});
                                    }

                                }
                            }

                        }
                    }, this);
                }

                // If a request object was sent, get its socket, otherwise assume a socket was sent.
                var socketToOmit = (req && req.socket ? req.socket : req);

                // In development environment, blast out a message to everyone
                if (sails.config.environment == 'development') {
                    sails.sockets.publishToFirehose(data);
                }

                data.verb = 'updated';
                data.previous = options.previous;
                delete data.model;

                // Broadcast to the model instance room
                this.publish(id, this.identity, 'update', data, socketToOmit);

                if (sails.util.isFunction(this.afterPublishUpdate)) {
                    this.afterPublishUpdate(id, changes, req, options);
                }


            },

            /**
             * Publish the destruction of a particular model
             *
             * @param {String|Finite} id
             *    - primary key of the instance we're referring to
             *
             * @param {Request|Socket} req - if specified, broadcast using this socket (effectively omitting it)
             *
             */

            publishDestroy: function (id, req, options) {

                options = options || {};

                // Enforce valid usage
                var invalidId = !id || _.isObject(id);
                if ( invalidId ) {
                    return sails.log.error(
                            'Invalid usage of ' + this.identity +
                            '`publishDestroy(id, [socketToOmit])`'
                    );
                }

                if (sails.util.isFunction(this.beforePublishDestroy)) {
                    this.beforePublishDestroy(id, req, options);
                }


                var data = {
                    model: this.identity,
                    verb: 'destroy',
                    id: id,
                    previous: options.previous
                };

                // If a request object was sent, get its socket, otherwise assume a socket was sent.
                var socketToOmit = (req && req.socket ? req.socket : req);

                // In development environment, blast out a message to everyone
                if (sails.config.environment == 'development') {
                    sails.sockets.publishToFirehose(data);
                }

                data.verb = 'destroyed';
                delete data.model;

                // Broadcast to the model instance room
                this.publish(id, this.identity, 'destroy', data, socketToOmit);

                // Unsubscribe everyone from the model instance
                this.retire(id);

                if (options.previous) {

                    var previous = options.previous;

                    // Loop through associations and alert as necessary
                    _.each(this.associations, function(association) {

                        var ReferencedModel;

                        // If it's a to-one association, and it wasn't falsy, alert
                        // the reverse side
                        if (association.type == 'model' && [association.alias] && previous[association.alias]) {
                            ReferencedModel = sails.models[association.model];
                            // Get the inverse association definition, if any
                            reverseAssociation = _.find(ReferencedModel.associations, {collection: this.identity}) || _.find(ReferencedModel.associations, {model: this.identity});

                            if (reverseAssociation) {
                                // If it's a to-one, publish a simple update alert
                                var referencedModelId = _.isObject(previous[association.alias]) ? previous[association.alias][ReferencedModel.primaryKey] : previous[association.alias];
                                if (reverseAssociation.type == 'model') {
                                    var pubData = {};
                                    pubData[reverseAssociation.alias] = null;
                                    ReferencedModel.publishUpdate(referencedModelId, pubData, {noReverse:true});
                                }
                                // If it's a to-many, publish a "removed" alert
                                else {
                                    ReferencedModel.publishRemove(referencedModelId, reverseAssociation.alias, id, req, {noReverse:true});
                                }
                            }
                        }

                        else if (association.type == 'collection' && previous[association.alias].length) {
                            ReferencedModel = sails.models[association.collection];
                            // Get the inverse association definition, if any
                            reverseAssociation = _.find(ReferencedModel.associations, {collection: this.identity}) || _.find(ReferencedModel.associations, {model: this.identity});

                            if (reverseAssociation) {
                                _.each(previous[association.alias], function(associatedModel) {
                                    // If it's a to-one, publish a simple update alert
                                    if (reverseAssociation.type == 'model') {
                                        var pubData = {};
                                        pubData[reverseAssociation.alias] = null;
                                        ReferencedModel.publishUpdate(associatedModel[ReferencedModel.primaryKey], pubData, req, {noReverse:true});
                                    }
                                    // If it's a to-many, publish a "removed" alert
                                    else {
                                        ReferencedModel.publishRemove(associatedModel[ReferencedModel.primaryKey], reverseAssociation.alias, id, req, {noReverse:true});
                                    }
                                });
                            }
                        }

                    }, this);

                }

                if (sails.util.isFunction(this.afterPublishDestroy)) {
                    this.afterPublishDestroy(id, req, options);
                }

            },


            /**
             * publishAdd
             *
             * @param  {[type]} id           [description]
             * @param  {[type]} alias        [description]
             * @param  {[type]} idAdded      [description]
             * @param  {[type]} socketToOmit [description]
             */

            publishAdd: function(id, alias, idAdded, req, options) {

                // Make sure there's an options object
                options = options || {};

                // Enforce valid usage
                var invalidId = !id || _.isObject(id);
                var invalidAlias = !alias || !_.isString(alias);
                var invalidAddedId = !idAdded || _.isObject(idAdded);
                if ( invalidId || invalidAlias || invalidAddedId ) {
                    return sails.log.error(
                            'Invalid usage of ' + this.identity +
                            '`publishAdd(id, alias, idAdded, [socketToOmit])`'
                    );
                }

                if (sails.util.isFunction(this.beforePublishAdd)) {
                    this.beforePublishAdd(id, alias, idAdded, req);
                }

                // If a request object was sent, get its socket, otherwise assume a socket was sent.
                var socketToOmit = (req && req.socket ? req.socket : req);


                // In development environment, blast out a message to everyone
                if (sails.config.environment == 'development') {
                    sails.sockets.publishToFirehose({
                        id: id,
                        model: this.identity,
                        verb: 'addedTo',
                        attribute: alias,
                        addedId: idAdded
                    });
                }

                this.publish(id, this.identity, 'add:'+alias, {
                    id: id,
                    verb: 'addedTo',
                    attribute: alias,
                    addedId: idAdded
                }, socketToOmit);

                if (!options.noReverse) {

                    // Get the reverse association
                    var reverseModel = sails.models[_.find(this.associations, {alias: alias}).collection];

                    var data;

                    // Subscribe to the model you're adding
                    if (req) {
                        data = {};
                        data[reverseModel.primaryKey] = idAdded;
                        reverseModel.subscribe(req, data);
                    }

                    var reverseAssociation = _.find(reverseModel.associations, {collection: this.identity}) || _.find(reverseModel.associations, {model: this.identity});

                    if (reverseAssociation) {
                        // If this is a many-to-many association, do a publishAdd for the
                        // other side.
                        if (reverseAssociation.type == 'collection') {
                            reverseModel.publishAdd(idAdded, reverseAssociation.alias, id, req, {noReverse:true});
                        }

                        // Otherwise, do a publishUpdate
                        else {
                            data = {};
                            data[reverseAssociation.alias] = id;
                            reverseModel.publishUpdate(idAdded, data, req, {noReverse:true});
                        }
                    }

                }


                if (sails.util.isFunction(this.afterPublishAdd)) {
                    this.afterPublishAdd(id, alias, idAdded, req);
                }

            },


            /**
             * publishRemove
             *
             * @param  {[type]} id           [description]
             * @param  {[type]} alias        [description]
             * @param  {[type]} idRemoved    [description]
             * @param  {[type]} socketToOmit [description]
             */

            publishRemove: function(id, alias, idRemoved, req, options) {

                // Make sure there's an options object
                options = options || {};

                // Enforce valid usage
                var invalidId = !id || _.isObject(id);
                var invalidAlias = !alias || !_.isString(alias);
                var invalidRemovedId = !idRemoved || _.isObject(idRemoved);
                if ( invalidId || invalidAlias || invalidRemovedId ) {
                    return sails.log.error(
                            'Invalid usage of ' + this.identity +
                            '`publishRemove(id, alias, idRemoved, [socketToOmit])`'
                    );
                }
                if (sails.util.isFunction(this.beforePublishRemove)) {
                    this.beforePublishRemove(id, alias, idRemoved, req);
                }

                // If a request object was sent, get its socket, otherwise assume a socket was sent.
                var socketToOmit = (req && req.socket ? req.socket : req);

                // In development environment, blast out a message to everyone
                if (sails.config.environment == 'development') {
                    sails.sockets.publishToFirehose({
                        id: id,
                        model: this.identity,
                        verb: 'removedFrom',
                        attribute: alias,
                        removedId: idRemoved
                    });
                }

                this.publish(id, this.identity, 'remove:' + alias, {
                    id: id,
                    verb: 'removedFrom',
                    attribute: alias,
                    removedId: idRemoved
                }, socketToOmit);


                if (!options.noReverse) {

                    // Get the reverse association
                    var reverseModel = sails.models[_.find(this.associations, {alias: alias}).collection];
                    var reverseAssociation = _.find(reverseModel.associations, {collection: this.identity}) || _.find(reverseModel.associations, {model: this.identity});

                    if (reverseAssociation) {
                        // If this is a many-to-many association, do a publishAdd for the
                        // other side.
                        if (reverseAssociation.type == 'collection') {
                            reverseModel.publishRemove(idRemoved, reverseAssociation.alias, id, req, {noReverse:true});
                        }

                        // Otherwise, do a publishUpdate
                        else {
                            var data = {};
                            data[reverseAssociation.alias] = null;
                            reverseModel.publishUpdate(idRemoved, data, req, {noReverse:true});
                        }
                    }

                }

                if (sails.util.isFunction(this.afterPublishRemove)) {
                    this.afterPublishRemove(id, alias, idRemoved, req);
                }

            },


            /**
             * Publish the creation of a model
             *
             * @param {Object} values
             *                - the data to publish
             *
             * @param {Request|Socket} req - if specified, broadcast using this socket (effectively omitting it)
             * @api private
             */

            publishCreate: function(values, req, options) {
                var self = this;

                options = options || {};

                if (!values[this.primaryKey]) {
                    return sails.log.error(
                            'Invalid usage of publishCreate() :: ' +
                            'Values must have an `'+this.primaryKey+'`, instead got ::\n' +
                            util.inspect(values)
                    );
                }

                if (sails.util.isFunction(this.beforePublishCreate)) {
                    this.beforePublishCreate(values, req);
                }

                // If any of the added values were association attributes, publish add or remove messages.
                _.each(values, function(val, key) {

                    // If the user hasn't yet given this association a value, bail out
                    if (val === null) {
                        return;
                    }

                    var attributes = this.attributes || {};
                    var referencedModel = attributes[key] && attributes[key].model;

                    // Bail if this attribute isn't in the model's schema
                    if (referencedModel) {
                        // Get the associated model class
                        var ReferencedModel = sails.models[referencedModel.toLowerCase()];
                        // Get the inverse association definition, if any
                        reverseAssociation = _.find(ReferencedModel.associations, {collection: this.identity}) || _.find(ReferencedModel.associations, {model: this.identity});

                        if (reverseAssociation) {

                            // If this is a many-to-many association, do a publishAdd for the
                            // other side.
                            if (reverseAssociation.type == 'collection') {
                                ReferencedModel.publishAdd(val, reverseAssociation.alias, values[this.primaryKey], req, {noReverse:true});
                            }

                            // Otherwise, do a publishUpdate
                            else {
                                var pubData = {};
                                pubData[reverseAssociation.alias] = values[this.primaryKey];
                                ReferencedModel.publishUpdate(val, pubData, req, {noReverse:true});
                            }

                        }

                    }
                }, this);

                // Ensure that we're working with a plain object
                values = _.clone(values);

                // If a request object was sent, get its socket, otherwise assume a socket was sent.
                var socketToOmit = (req && req.socket ? req.socket : req);

                // Blast success message
                sails.sockets.publishToFirehose({

                    model: this.identity,
                    verb: 'create',
                    data: values,
                    id: values[this.primaryKey]

                });

                // Publish to classroom
                var eventName = this.identity;
                this.broadcast(this._classRoom(), eventName, {
                    verb: 'created',
                    data: values,
                    id: values[this.primaryKey]
                }, socketToOmit);

                // Also broadcasts a message to the legacy class room (derived by
                // using the `:legacy_v0.9` trailer on the class room name).
                // Uses traditional eventName === "message".
                // Uses traditional message format.
                if (sails.config.sockets['backwardsCompatibilityFor0.9SocketClients']) {
                    var legacyData = _.cloneDeep({
                        verb: 'create',
                        data: values,
                        model: self.identity,
                        id: values[this.primaryKey]
                    });
                    var legacyRoom = this._classRoom()+':legacy_v0.9';
                    self.broadcast( legacyRoom, 'message', legacyData, socketToOmit );
                }

                // Subscribe watchers to the new instance
                if (!options.noIntroduce) {
                    this.introduce(values[this.primaryKey]);
                }

                if (sails.util.isFunction(this.afterPublishCreate)) {
                    this.afterPublishCreate(values, req);
                }

            },


            /**
             *
             * @return {[type]} [description]
             */
            watch: function ( req ) {

                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'This call has failed silently.';
                sails.log.warn(notImplementedError);

            },

            /**
             * [unwatch description]
             * @param  {[type]} socket [description]
             * @return {[type]}        [description]
             */
            unwatch: function ( req ) {

                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'This call has failed silently.';
                sails.log.warn(notImplementedError);
            },


            /**
             * Introduce a new instance
             *
             * Take all of the subscribers to the class room and 'introduce' them
             * to a new instance room
             *
             * @param {String|Finite} id
             *    - primary key of the instance we're referring to
             *
             * @api private
             */

            introduce: function(model) {

                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'This call has failed silently.';
                sails.log.warn(notImplementedError);

            },

            /**
             * Bid farewell to a destroyed instance
             * Take all of the socket subscribers in this instance room
             * and unsubscribe them from it
             */
            retire: function(model) {

                var notImplementedError =
                    'The standalone socket emitter does not support any subscription/req.socket based methods.'
                'This call has failed silently.';
                sails.log.warn(notImplementedError);

            }

        };
    }
};
